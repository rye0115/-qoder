"""用产品提供的固定场景访问正在运行的站点。指定站点根地址和报告路径。"""
import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site")
    parser.add_argument("output", type=Path)
    parser.add_argument("--fixture", type=Path, default=Path(__file__).resolve().parents[2]
                        / "jingheng-qoder-entry" / "产品参考" / "原版验收样例.json")
    args = parser.parse_args()
    site = args.site.rstrip("/")
    address = urlsplit(site)
    origin = f"{address.scheme}://{address.netloc}"
    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))

    def read(path, body=None):
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        headers = {"Content-Type": "application/json"}
        if data is not None:
            headers.update({"Origin": origin, "Referer": origin + "/"})
        request = Request(site + path, data=data, headers=headers)
        with urlopen(request, timeout=55) as response:
            return json.load(response)

    def check_scenario(scenario):
        expected = scenario["expected"]
        try:
            result = read(scenario["path"], scenario["body"])
            if "event" in expected:
                row = next(item for item in result["rows"] if item["event"] == expected["event"])
                actual = {key: (row["fit"]["status"] if key == "fit" else row[key])
                          for key in expected}
            else:
                actual = {"policyScore": result["score"], "measurement": result["measurement"],
                          "confidence": result["confidence"]["index"],
                          "independent": result["confidence"]["independent"]}
            return {**scenario, "actual": actual, "passed": actual == expected}
        except Exception as error:
            return {**scenario, "error": str(error), "passed": False}

    ratings = read("/api/ratings")["ratings"]
    actual = [(r["event"], r["score"]) for r in ratings]
    expected = [(r["event"], r["score"]) for r in fixture["ratings"]]
    with ThreadPoolExecutor(max_workers=2) as pool:
        checks = list(pool.map(check_scenario, fixture["scenarios"]))
    report = {"time": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
              "site": site, "access": "无登录，POST 带网页同源 Origin 和 Referer", "eventCount": len(actual),
              "ranked": sum(score is not None for _, score in actual), "ranking": actual,
              "rankingMatches": actual == expected, "scenarios": checks}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{site}　{len(actual)} 项赛事，{report['ranked']} 项有分，"
          f"排序和分值匹配={report['rankingMatches']}，场景通过 {sum(c['passed'] for c in checks)}/{len(checks)}")
    return 0 if report["rankingMatches"] and all(c["passed"] for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(run())
