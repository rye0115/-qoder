import http from 'node:http';
import worker from '../competition-atlas/dist/server/index.js';

const port=48737;
const origin='http://127.0.0.1:'+port;
const server=http.createServer(async(req,res)=>{
  try{
    const chunks=[];
    let length=0;
    for await(const chunk of req){
      length+=chunk.length;
      if(length>8192){res.writeHead(413);res.end('Query too large');return;}
      chunks.push(chunk);
    }
    const body=Buffer.concat(chunks);
    const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,body:body.length?body:undefined});
    const result=await worker.fetch(request);
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Request could not be completed');}
});
server.on('error',e=>{if(e.code==='EADDRINUSE'){console.error('端口已占用。若竞衡已启动，请打开 '+origin);}else console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('竞衡已启动：'+origin+' 。此窗口关闭后服务停止。'));
