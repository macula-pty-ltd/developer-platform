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
