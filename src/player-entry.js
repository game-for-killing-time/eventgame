const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Both game modes use the published classic player entrance.
export function playerEntry({room = '', name = '', busy = false, hint = ''} = {}) {
 return `<form id="joinForm" aria-labelledby="joinTitle" aria-busy="${busy}">
  <h1 id="joinTitle" class="join-title">一起上島。</h1>
  <p class="join-intro">輸入房間碼和暱稱，就能加入派對。</p>
  <label for="roomCode">房間碼</label>
  <input id="roomCode" name="room" maxlength="6" pattern="[A-Za-z0-9]{6}" value="${esc(room)}" placeholder="輸入 6 位房間碼" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
  <label for="nickname">暱稱</label>
  <input id="nickname" name="nickname" maxlength="20" value="${esc(name)}" placeholder="大家怎樣稱呼你？" autocomplete="nickname" required>
  <button class="primary" type="submit" ${busy?'disabled':''}>${busy?'正在加入…':'加入派對'}</button>
  <p class="hint">毋須註冊，入座後會獲派一位島民。</p>
  ${hint?`<p class="entry-hint" role="status">${esc(hint)}</p>`:''}
 </form>`;
}

export function playerDetails(form) {
 const code = form.querySelector('#roomCode').value.trim().toUpperCase();
 const name = form.querySelector('#nickname').value.trim();
 if (!/^[A-Z0-9]{6}$/.test(code)) throw Error('請輸入 6 位英文字母或數字房間碼。');
 if (!name || name.length > 20) throw Error('暱稱需為 1–20 字。');
 return {code, name};
}
