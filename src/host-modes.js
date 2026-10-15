import './host-modes.css';
export function hostModes(current){
 const demo=new URLSearchParams(location.search).get('demo')==='1'?'&demo=1':'';
 return `<nav class="host-mode-switch" aria-label="主持模式"><span>主持模式</span><a href="./host.html?mode=classic${demo}" ${current==='classic'?'aria-current="page"':''}>選邊站</a><button type="button" disabled aria-describedby="voyageUnavailable">12 幕冒險</button><small id="voyageUnavailable">12 幕冒險製作中，暫未開放</small></nav>`;
}
