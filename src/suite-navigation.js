const destinations = [
  ['explorer','Explorer','https://explorer.macula.co.za/'],
  ['developers','Developers','https://dev.macula.co.za/#/'],
  ['network','Network','https://dev.macula.co.za/#/status'],
];
export function suiteHeader({active,section,items,current}) {
  const links=items.map(([key,label,url])=>`<a href="${url}" ${current===key?'aria-current="page"':''}>${label}</a>`).join('');
  const selected=items.find(([key])=>key===current)?.[1]||(active==='network'?'Network':section);
  return `<header class="suite-header" data-suite-page="${active}"><div class="suite-main"><a class="suite-brand" href="https://macula.co.za/" aria-label="MACULA home">MACULA <span>BlockDAG</span></a><nav class="suite-primary" aria-label="MACULA BlockDAG navigation">${destinations.map(([key,label,url])=>`<a href="${url}" ${active===key?'aria-current="location"':''}>${label}</a>`).join('')}</nav><span class="suite-chain">Chain 1404</span></div><div class="suite-context"><span class="suite-section">${section}</span><nav class="suite-tools" aria-label="${section}">${links}</nav><details class="suite-mobile"><summary><span>${selected}</span><span class="suite-menu-label">Menu<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></summary><nav aria-label="${section} menu">${links}</nav></details></div></header>`;
}


export function bindSuiteNavigation(){
 document.addEventListener('click',event=>{const link=event.target.closest('.suite-mobile nav a');if(link)link.closest('details').open=false;});
 const update=()=>{const header=document.querySelector('.suite-header[data-suite-page="explorer"]');if(!header)return;const current=['#blocks','#transactions'].includes(location.hash)?location.hash:'/';let label='Overview';header.querySelectorAll('.suite-tools a,.suite-mobile nav a').forEach(a=>{a.removeAttribute('aria-current');if(a.getAttribute('href')===current){a.setAttribute('aria-current','location');label=a.textContent;}});header.querySelector('.suite-mobile summary>span').textContent=label;};
 window.addEventListener('hashchange',update);update();
}
export const suiteNavigationScript = `(${bindSuiteNavigation.toString()})();`;
if(typeof document!=='undefined')bindSuiteNavigation();

export function suiteFooter({site}) {
 const dev='https://dev.macula.co.za/';
 const groups=[
  ['Explore the network', [['Explorer overview','https://explorer.macula.co.za/'],['Latest blocks','https://explorer.macula.co.za/#blocks'],['Recent transactions','https://explorer.macula.co.za/#transactions'],['Network status',dev+'#/status']]],
  ['Build a contract', [['Solidity playground',dev+'#/playground?template=counter'],['Full Remix IDE',dev+'remix/macula-20261013-v1/#optimize=true&runs=200&evmVersion=paris&version=soljson-v0.8.37%2Bcommit.f401782d.js&activate=solidity'],['Contract examples',dev+'#/contracts'],['Verify contract source',dev+'#/verify']]],
  ['Connect your app', [['Quickstart',dev+'#/docs?section=quickstart'],['RPC & wallet setup',dev+'#/docs?section=network'],['Deployment workflow',dev+'#/docs?section=workflow'],['API documentation',dev+'#/docs?section=api']]],
  ['Learn & contribute', [['Run the starter locally',dev+'#/docs?section=tools'],['Community projects',dev+'#/projects'],['Source on GitHub','https://github.com/macula-pty-ltd/developer-platform'],['Contact Macula','https://macula.co.za/contact']]],
 ];
 const next=site==='explorer'?['Move from exploring to building.','Try a contract with fake funds, then connect your application to the same network.','Open the playground',dev+'#/playground?template=counter']:['Follow what you build.','Track blocks and transaction receipts in the Explorer as you develop.','Open Explorer','https://explorer.macula.co.za/'];
 return `<footer class="suite-footer" id="stack-footer"><div class="suite-footer-inner"><div class="suite-next"><div><h2>${next[0]}</h2><p>${next[1]}</p></div><a class="suite-next-link" href="${next[3]}">${next[2]} <span aria-hidden="true">↗</span></a></div><div class="suite-footer-title"><a href="https://macula.co.za/">MACULA <span>BlockDAG developer stack</span></a><p>Explore. Build. Connect.</p></div><nav class="suite-footer-map" aria-label="Developer stack sitemap">${groups.map(([title,links])=>`<div><h3>${title}</h3><ul>${links.map(([label,url])=>`<li><a href="${url}">${label}</a></li>`).join('')}</ul></div>`).join('')}</nav><div class="suite-footer-base"><p><strong>MACULA (Pty) Ltd</strong> · Registration 2013/028237/07<br>Art &amp; Design Centre, 72 Loop Street, Cape Town, 8001, South Africa</p><div><span>Independently operated on DreamPIE</span><a href="https://macula.co.za/privacy">Privacy</a></div></div></div></footer>`;
}
