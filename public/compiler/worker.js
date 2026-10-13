let compiler, imports;
async function prepare() {
 if (!compiler) {
  await new Promise((resolve,reject)=>{self.Module={onRuntimeInitialized:resolve};try{importScripts('/compiler/soljson.js');if(self.Module?.calledRun)resolve();}catch(e){reject(e)}});
  compiler=self.Module.cwrap('solidity_compile','string',['string','number','number']);
 }
 imports ||= await (await fetch('/imports.json')).json();
}
function resolveImport(path,importer){return path.startsWith('.')?new URL(path,'https://sources.invalid/'+importer).pathname.slice(1):path}
self.onmessage=async({data})=>{try{await prepare();const sources={},available={...imports,[data.filename]:data.source},queue=[data.filename];while(queue.length){const name=queue.shift();if(sources[name])continue;if(!(name in available))throw Error('Import not available: '+name);sources[name]={content:available[name]};for(const m of available[name].matchAll(/import\s+(?:[^;]*?\sfrom\s*)?["']([^"']+)["']\s*;/g))queue.push(resolveImport(m[1],name));if(Object.keys(sources).length>180)throw Error('Import graph too large')}const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','metadata','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences']}}}};const output=JSON.parse(compiler(JSON.stringify(input),0,0));self.postMessage({id:data.id,output,input,version:self.Module.cwrap('solidity_version','string',[])()});}catch(e){self.postMessage({id:data.id,error:e.message})}};
