import fs from 'node:fs';import {suiteHeader,suiteNavigationScript,suiteFooter} from '../src/suite-navigation.js';
const path=process.argv[2]||'../macula-explorer/src/explorer.html';let html=fs.readFileSync(path,'utf8');
const header=suiteHeader({active:'explorer',section:'Explorer tools',current:'overview',items:[['overview','Overview','/'],['blocks','Blocks','#blocks'],['transactions','Transactions','#transactions'],['api','API docs','https://dev.macula.co.za/#/docs?section=api']]});
html=html.replace(/<header[\s\S]*?<\/header>/,header);
html=html.replace('<div class="wrap">'+header,header+'<div class="wrap">');
html=html.replace(/\/\* suite-navigation:start \*\/[\s\S]*?\/\* suite-navigation:end \*\//,'');
html=html.replace(/<script data-suite-navigation>[\s\S]*?<\/script>/,'');html=html.replace('</body>','<script data-suite-navigation>'+suiteNavigationScript+'</script></body>');
const css=fs.readFileSync('src/suite-navigation.css','utf8');html=html.replace('</style>','\n/* suite-navigation:start */\n'+css+'\n/* suite-navigation:end */\n</style>');fs.writeFileSync(path,html);

const footer=suiteFooter({site:'explorer'});
html=html.replace(/<footer[\s\S]*?<\/footer>/,footer);
html=html.replace(footer+'</div>', '</div>'+footer);
html=html.replace(/\/\* suite-footer:start \*\/[\s\S]*?\/\* suite-footer:end \*\//,'');
html=html.replace('</style>','\n/* suite-footer:start */\n'+fs.readFileSync('src/suite-footer.css','utf8')+'\n/* suite-footer:end */\n</style>');fs.writeFileSync(path,html);
