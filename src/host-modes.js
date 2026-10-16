import './host-modes.css';
export function hostModes(current){
 const demo=new URLSearchParams(location.search).get('demo')==='1'?'&demo=1':'';
 return `<nav class="host-mode-switch" aria-label="主持模式"><span>主持模式</span><a href="./host.html?mode=classic${demo}" ${current==='classic'?'aria-current="page"':''}>選邊站</a><a href="./host.html?mode=voyage${demo}" ${current==='voyage'?'aria-current="page"':''}>12 幕冒險</a>${!demo?'<span class="broadcast-control"><button type="button" data-broadcast disabled>切換至展示</button><small data-broadcast-status role="status">讀取展示模式…</small></span>':''}</nav>`;
}
