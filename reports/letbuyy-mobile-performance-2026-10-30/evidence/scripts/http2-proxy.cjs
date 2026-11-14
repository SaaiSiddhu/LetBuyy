const fs=require('node:fs'),http=require('node:http'),http2=require('node:http2');
const folder='/tmp/letbuyy-mobile-performance-20261030/tls';
for(const [port,target]of[[9040,9038],[9041,9039]]){
 const server=http2.createSecureServer({key:fs.readFileSync(folder+'/key.pem'),cert:fs.readFileSync(folder+'/cert.pem'),allowHTTP1:true},(request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return}
  const headers={};for(const [key,value]of Object.entries(request.headers))if(!key.startsWith(':')&&!['connection','host'].includes(key))headers[key]=value;
  headers.host='127.0.0.1:'+target;
  const upstream=http.request({hostname:'127.0.0.1',port:target,path:request.url,method:request.method,headers},result=>{
   const outgoing={};for(const[key,value]of Object.entries(result.headers))if(!['connection','keep-alive','transfer-encoding','upgrade','proxy-connection'].includes(key)&&value!==undefined)outgoing[key]=value;
   response.writeHead(result.statusCode,outgoing);result.pipe(response);
  });upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end()});request.on('aborted',()=>upstream.destroy());upstream.end();
 });server.listen(port,'127.0.0.1',()=>console.log(`Read-only HTTP2 comparison ${port}→${target}`));
}
