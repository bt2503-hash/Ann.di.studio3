
(function(){
  const configured=window.ANN_SUPABASE_URL && !window.ANN_SUPABASE_URL.includes('PASTE_') &&
    window.ANN_SUPABASE_ANON_KEY && !window.ANN_SUPABASE_ANON_KEY.includes('PASTE_');
  window.annDb = configured && window.supabase ? window.supabase.createClient(window.ANN_SUPABASE_URL,window.ANN_SUPABASE_ANON_KEY) : null;
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentUser=null, modalReady=false;
  const modal=()=>$('#accountModal');
  function showModal(){if(!modal())return;modal().classList.add('open');modal().setAttribute('aria-hidden','false');renderAccount();}
  function hideModal(){if(!modal())return;modal().classList.remove('open');modal().setAttribute('aria-hidden','true')}
  function accountButton(){const b=$('#accountToggle');if(b){b.title=currentUser?'Особистий кабінет':'Увійти / Реєстрація';b.setAttribute('aria-label',b.title);b.textContent=currentUser?'●':'♙'}}
  function notice(s){const el=$('#accountNotice');if(el)el.textContent=s}
  async function loadOrders(){
    if(!annDb||!currentUser)return [];
    const {data,error}=await annDb.from('orders').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
    if(error)throw error; return data||[];
  }
  async function renderAccount(){
    const root=$('#accountContent');if(!root)return;
    if(!annDb){root.innerHTML='<p class="eyebrow">CUSTOMER ACCOUNT</p><h2>Особистий кабінет</h2><p>База даних ще не налаштована. Спочатку заповни <code>supabase-config.js</code> та виконай SQL із файлу <code>supabase-setup.sql</code>.</p>';return}
    if(!currentUser){
      root.innerHTML=`<p class="eyebrow">ANN·DI STUDIO</p><h2>Особистий кабінет</h2><div class="account-tabs"><button type="button" class="btn btn-dark" id="showSignIn">Увійти</button><button type="button" class="btn btn-outline" id="showSignUp">Реєстрація</button></div><form id="accountForm" class="account-form"><label id="accountNameWrap" hidden>Ім’я<input name="name" autocomplete="name"></label><label>E-mail<input name="email" type="email" required autocomplete="email"></label><label>Пароль<input name="password" type="password" minlength="6" required autocomplete="current-password"></label><button class="btn btn-dark full" id="accountSubmit">Увійти</button><p id="accountNotice" role="status"></p></form>`;
      let mode='signin';
      $('#showSignIn').onclick=()=>{mode='signin';$('#accountNameWrap').hidden=true;$('#accountSubmit').textContent='Увійти';notice('')};
      $('#showSignUp').onclick=()=>{mode='signup';$('#accountNameWrap').hidden=false;$('#accountSubmit').textContent='Створити акаунт';notice('')};
      $('#accountForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),email=fd.get('email'),password=fd.get('password');$('#accountSubmit').disabled=true;
        try{
          if(mode==='signup'){const {data,error}=await annDb.auth.signUp({email,password,options:{data:{full_name:fd.get('name')||''}}});if(error)throw error;notice(data.session?'Акаунт створено. Ви увійшли.':'Перевірте пошту та підтвердьте реєстрацію, потім увійдіть.')}
          else {const {error}=await annDb.auth.signInWithPassword({email,password});if(error)throw error;await refreshUser();renderAccount()}
        }catch(err){notice(err.message||'Не вдалося виконати дію')}finally{$('#accountSubmit')&&($('#accountSubmit').disabled=false)}
      };
      return;
    }
    root.innerHTML=`<p class="eyebrow">MY ANN·DI</p><h2>Мій кабінет</h2><p class="account-email">${esc(currentUser.email)}</p><div class="account-tabs"><button type="button" class="btn btn-dark" id="ordersRefresh">Мої замовлення</button><button type="button" class="btn btn-outline" id="accountLogout">Вийти</button></div><div id="myOrders"><p>Завантажуємо замовлення…</p></div>`;
    $('#accountLogout').onclick=async()=>{await annDb.auth.signOut();await refreshUser();renderAccount()};
    $('#ordersRefresh').onclick=()=>renderOrdersInAccount();
    await renderOrdersInAccount();
  }
  async function renderOrdersInAccount(){
    const box=$('#myOrders');if(!box)return;box.innerHTML='<p>Завантажуємо замовлення…</p>';
    try{const orders=await loadOrders();if(!orders.length){box.innerHTML='<p>Поки що у вас немає замовлень.</p>';return}
      box.innerHTML=orders.map(o=>`<article class="my-order"><div><b>Замовлення #${esc(o.order_number||o.id)}</b><span>${new Date(o.created_at).toLocaleString('uk-UA')}</span></div><p>Статус: <strong>${esc(o.status||'Нове')}</strong></p><ul>${(o.items||[]).map(i=>`<li>${esc(i.name)} × ${Number(i.qty)||1} — ${new Intl.NumberFormat('uk-UA').format(Number(i.price)||0)} грн</li>`).join('')}</ul><b>Разом: ${new Intl.NumberFormat('uk-UA').format(Number(o.total)||0)} грн</b></article>`).join('');
    }catch(err){box.innerHTML='<p class="account-error">Не вдалося завантажити замовлення. Перевір налаштування бази даних.</p>'}
  }
  async function refreshUser(){if(!annDb){currentUser=null;accountButton();return}const {data}=await annDb.auth.getSession();currentUser=data.session?.user||null;accountButton()}
  window.ANN_CLOUD={
    get user(){return currentUser}, get ready(){return !!annDb},
    openAccount:showModal,
    async ensureSignedIn(){if(!annDb){alert('База даних ще не налаштована.');showModal();return false}if(currentUser)return true;showModal();notice('Щоб бачити історію замовлень, увійдіть або створіть акаунт.');return false},
    async createOrder(order){
      if(!annDb||!currentUser)throw new Error('Увійдіть в особистий кабінет перед оформленням замовлення.');
      const payload={user_id:currentUser.id,order_number:order.id,customer:order.customer,email:currentUser.email,phone:order.phone,city:order.city,region:order.region,branch:order.branch,address:order.address,delivery:order.delivery,payment:order.payment,comment:order.comment,items:order.items,total:order.total,status:'Нове'};
      const {data,error}=await annDb.from('orders').insert(payload).select().single();if(error)throw error;return data;
    },
    async adminLogin(email,password){if(!annDb)throw new Error('Спочатку налаштуйте Supabase.');const {data,error}=await annDb.auth.signInWithPassword({email,password});if(error)throw error;currentUser=data.user;const role=data.user.app_metadata?.role;if(role!=='admin'){await annDb.auth.signOut();currentUser=null;throw new Error('Цей акаунт не має прав адміністратора. Призначте role=admin у Supabase Auth → Users.')}return data.user},
    async adminOrders(){if(!annDb)throw new Error('Supabase не налаштовано');const {data,error}=await annDb.from('orders').select('*').order('created_at',{ascending:false});if(error)throw error;return data||[]},
    async updateOrderStatus(id,status){const {error}=await annDb.from('orders').update({status}).eq('id',id);if(error)throw error},
    async deleteOrder(id){const {error}=await annDb.from('orders').delete().eq('id',id);if(error)throw error},
    async adminLogout(){if(annDb)await annDb.auth.signOut();currentUser=null;accountButton()}
  };
  document.addEventListener('DOMContentLoaded',async()=>{
    if($('#accountToggle'))$('#accountToggle').addEventListener('click',showModal);
    if($('#accountClose'))$('#accountClose').addEventListener('click',hideModal);
    if(modal())modal().addEventListener('click',e=>{if(e.target===modal())hideModal()});
    if(annDb){await refreshUser();annDb.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;accountButton()})}else accountButton();
  });
})();
