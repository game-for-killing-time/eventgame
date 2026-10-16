import './host-modes.css';
export function hostModes(current){
 const demo=new URLSearchParams(location.search).get('demo')==='1'?'&demo=1':'';
 return `<nav class="host-mode-switch" aria-label="主持模式"><span>主持模式</span><a ${!demo?'data-host-mode="classic" aria-disabled="true"':''} href="./host.html?mode=classic${demo}" ${current==='classic'?'aria-current="page"':''}>選邊站</a><a ${!demo?'data-host-mode="voyage" aria-disabled="true"':''} href="./host.html?mode=voyage${demo}" ${current==='voyage'?'aria-current="page"':''}>12 幕冒險</a>${!demo?'<span class="broadcast-control"><small data-broadcast-status role="status">正在同步房間…</small></span>':''}</nav>`;
}
