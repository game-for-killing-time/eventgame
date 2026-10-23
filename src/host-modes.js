import './host-modes.css';
export function hostModes(current){
 const demo=new URLSearchParams(location.search).get('demo')==='1'?'&demo=1':'';
 const option=(mode,label)=>demo?`<a href="./host.html?mode=${mode}${demo}" ${current===mode?'aria-current="page"':''}>${label}</a>`:`<button type="button" data-host-mode="${mode}" disabled aria-disabled="true" ${current===mode?'aria-current="page"':''}>${label}</button>`;
 return `<nav class="host-mode-switch" aria-label="主持模式"><span>主持模式</span>${option('classic','選邊站')}<a href="./host.html?mode=voyage" ${current==='voyage'?'aria-current="page"':''}>墜機逃生・狼人</a>${!demo?'<span class="broadcast-control"><small data-broadcast-status role="status">正在同步房間…</small></span>':''}</nav>`;
}
