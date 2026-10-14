import QRCode from 'qrcode';

export function createInvite(container){
 container.innerHTML='<label for="inviteUrl">觀眾邀請連結（已帶入房間碼）</label><input id="inviteUrl" readonly type="url"><button type="button" class="copy-invite">複製邀請連結</button><p class="invite-status" role="status"></p><details class="invite-qr"><summary>顯示入場 QR Code</summary><canvas role="img" aria-label="掃描開啟本場觀眾邀請連結"></canvas><p>手機掃描後，輸入暱稱即可入座。</p></details><p class="invite-warning hint"></p>';
 const input=container.querySelector('input'),status=container.querySelector('.invite-status'),details=container.querySelector('details'),canvas=container.querySelector('canvas'),copy=container.querySelector('button');
 let current='',qrFor='';
 async function draw(){if(!details.open||!current||qrFor===current)return;const url=current;try{await QRCode.toCanvas(canvas,url,{width:256,margin:4,errorCorrectionLevel:'M'});if(current===url)qrFor=url;}catch{status.textContent='QR Code 暫時無法產生，請先複製連結。';}}
 details.addEventListener('toggle',draw);
 input.onclick=()=>input.select();
 copy.onclick=async()=>{const url=current;if(!url)return;try{await navigator.clipboard.writeText(url);if(current===url)status.textContent='已複製，可以貼給朋友了。';}catch{if(current!==url)return;input.focus();input.select();status.textContent='瀏覽器未允許複製，請複製上方已選取的連結。';}};
 return ({url,available,demo,local,locked})=>{
  container.hidden=!available;
  const next=available?url:'';
  if(next!==current){current=next;input.value=next;status.textContent='';details.open=false;qrFor='';canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
  copy.disabled=!available||locked;input.disabled=!!locked;details.hidden=!!locked;if(locked)details.open=false;
  container.querySelector('.invite-warning').textContent=locked?'目前已鎖定加入，請先重新開放加入再邀請朋友。':demo?'這是本機示範，只在同一瀏覽器同步；邀請手機請使用正式網站。':local?'這是本機網址，其他手機可能無法連線；正式邀請請使用 GitHub Pages。':'';
 };
}
