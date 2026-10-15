import './host-modes.css';
export function hostModes(current){
 const demo=new URLSearchParams(location.search).get('demo')==='1'?'&demo=1':'';
 return `<nav class="host-mode-switch" aria-label="主持模式"><span>主持模式</span><a href="./host.html?mode=classic${demo}" ${current==='classic'?'aria-current="page"':''}>選邊站</a><a href="./host.html?mode=voyage${demo}" ${current==='voyage'?'aria-current="page"':''}>12 幕冒險</a><small>切換模式保留各自房間進度</small></nav>`;
}
