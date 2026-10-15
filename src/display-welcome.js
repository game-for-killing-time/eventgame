import QRCode from 'qrcode';

export function renderDisplayWelcome(container,url){
 if(container.querySelector('.display-welcome'))return;
 container.innerHTML=`<section class="display-welcome" aria-label="小島開場等候區">
  <div class="campfire-caption"><p>火已經生好，就差你。</p><span>嘴上互傷，今晚一起同樂。</span></div>
  <aside class="display-entry"><span class="opening-status">等主持人開場</span><h1>來小島，<br>一起熱鬧。</h1><p>先用手機掃碼，打開玩家入口。<br>房間開好後，填暱稱就能入座。</p><canvas class="display-qr" role="img" aria-label="掃碼前往玩家入口"></canvas><a class="player-entry-link" target="_blank" rel="noopener">前往玩家入口 ↗</a><p class="qr-status" role="status"></p><small>選自己的答案，猜朋友的心思。</small></aside>
 </section>`;
 container.querySelector('a').href=url;
 const canvas=container.querySelector('canvas'),status=container.querySelector('.qr-status');
 const local=['localhost','127.0.0.1'].includes(location.hostname);
 if(local)status.textContent='本機預覽：手機掃碼須使用可公開存取的網址。';
 else if(new URL(url).searchParams.get('demo')==='1')status.textContent='目前為本機模擬，手機與電腦不會同步。';
 QRCode.toCanvas(canvas,url,{width:320,margin:4,errorCorrectionLevel:'M',color:{dark:'#183e35',light:'#ffffff'}}).then(()=>{canvas.style.removeProperty('width');canvas.style.removeProperty('height');}).catch(()=>{canvas.hidden=true;status.textContent='QR Code 暫時未能載入，請使用玩家入口連結。';});
}
