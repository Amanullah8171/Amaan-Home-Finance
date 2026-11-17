/* Firestore-like data layer on top of Supabase (table public.docs).
   window.AmaanCloud.configured()  -> true when config.js has URL + key
   window.AmaanCloud.start()       -> Promise<db> (shows login first)
   window.AmaanCloud.signOut()     -> signs out of the cloud and reloads */
(function(){
  var cfg=window.AMAAN_CONFIG||{};
  var TBL=cfg.TABLE||'docs';
  var sb=null,uid=null,cache={},loaded={},subs={},docSubs={},pend={},channel=null,onErr=[];

  function configured(){return !!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase)}
  function client(){if(!sb)sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});return sb}
  function col(n){return cache[n]||(cache[n]={})}
  function newId(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
  function fail(e){onErr.forEach(function(f){try{f(e)}catch(x){}})}

  function emitCol(n){
    var c=col(n),docs=Object.keys(c).map(function(id){return {id:id,exists:true,data:function(){return c[id]}}});
    var snap={docs:docs,metadata:{hasPendingWrites:(pend[n]||0)>0}};
    (subs[n]||[]).forEach(function(s){try{s.f(snap)}catch(e){console.error(e)}});
    var dm=docSubs[n]||{};
    Object.keys(dm).forEach(function(id){emitDoc(n,id)});
  }
  function emitDoc(n,id){
    var c=col(n),has=Object.prototype.hasOwnProperty.call(c,id);
    var snap=has?{id:id,exists:true,data:function(){return c[id]}}:{id:id,exists:false,data:function(){return undefined}};
    ((docSubs[n]||{})[id]||[]).forEach(function(s){try{s.f(snap)}catch(e){console.error(e)}});
  }

  async function loadCol(n){
    var from=0,step=1000,c={};
    for(;;){
      var r=await client().from(TBL).select('id,data').eq('coll',n).order('id').range(from,from+step-1);
      if(r.error)throw r.error;
      r.data.forEach(function(row){c[row.id]=row.data});
      if(r.data.length<step)break;from+=step;
    }
    cache[n]=Object.assign(c,{});loaded[n]=true;emitCol(n);
  }
  function ensure(n,errCb){
    if(loaded[n]===true){emitCol(n);return}
    if(loaded[n]==='loading')return;
    loaded[n]='loading';
    loadCol(n).catch(function(e){loaded[n]=false;console.error(e);if(errCb)errCb(e);fail(e)});
  }
  function listen(){
    if(channel)return;
    channel=client().channel(TBL+'-'+uid).on('postgres_changes',{event:'*',schema:'public',table:TBL,filter:'owner=eq.'+uid},function(p){
      var row=p.eventType==='DELETE'?p.old:p.new;if(!row)return;
      var n=row.coll;if(!loaded[n]||loaded[n]==='loading')return;
      var id=row.id,c=col(n);
      if(p.eventType==='DELETE'){if(!(id in c))return;delete c[id]}
      else{if(JSON.stringify(c[id])===JSON.stringify(row.data))return;c[id]=row.data}
      emitCol(n);
    }).subscribe();
  }

  async function write(n,id,op){
    pend[n]=(pend[n]||0)+1;emitCol(n);
    try{
      var r=await op();if(r&&r.error)throw r.error;
    }catch(e){
      console.error('cloud write failed',e);fail(e);
      try{await loadCol(n)}catch(x){}
      throw e;
    }finally{pend[n]=Math.max(0,(pend[n]||1)-1);emitCol(n)}
  }
  function put(n,id,d){
    col(n)[id]=d;
    return write(n,id,function(){return client().from(TBL).upsert({owner:uid,coll:n,id:id,data:d,updated_at:new Date().toISOString()},{onConflict:'owner,coll,id'})});
  }
  function clean(d){return JSON.parse(JSON.stringify(d))}

  function docRef(n,id){
    return {id:id,
      set:function(d){return put(n,id,clean(d))},
      update:function(d){var cur=col(n)[id]||{};return put(n,id,Object.assign({},cur,clean(d)))},
      delete:function(){delete col(n)[id];return write(n,id,function(){return client().from(TBL).delete().eq('coll',n).eq('id',id)})},
      onSnapshot:function(f,e){
        var m=docSubs[n]||(docSubs[n]={});(m[id]||(m[id]=[])).push({f:f});
        if(loaded[n]===true)emitDoc(n,id);else ensure(n,e);
        return function(){m[id]=(m[id]||[]).filter(function(s){return s.f!==f})};
      }};
  }
  function colRef(n){
    var q={orderBy:function(){return q},limit:function(){return q},
      onSnapshot:function(f,e){
        (subs[n]||(subs[n]=[])).push({f:f});ensure(n,e);
        return function(){subs[n]=(subs[n]||[]).filter(function(s){return s.f!==f})};
      },
      add:function(d){var id=newId();return put(n,id,clean(d)).then(function(){return {id:id}})},
      doc:function(id){return docRef(n,id)}};
    return q;
  }
  function makeDb(){return {collection:colRef,doc:function(p){var a=p.split('/');return docRef(a[0],a[1])},onError:function(f){onErr.push(f)}}}

  /* ---------- login screen ---------- */
  function gate(){
    return new Promise(function(resolve){
      var s=client();
      s.auth.getSession().then(function(r){
        if(r&&r.data&&r.data.session){resolve(r.data.session);return}
        var w=document.createElement('div');
        w.style.cssText='position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#0f766e,#4f46e5);display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;padding:16px';
        w.innerHTML='<form style="background:#fff;border-radius:18px;padding:28px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
          +'<div style="font-size:20px;font-weight:700;color:#0f172a">Amaan ERP</div>'
          +'<div style="font-size:13px;color:#64748b;margin:4px 0 18px">Sign in to your cloud account</div>'
          +'<input name=e type=email required placeholder="Email" autocomplete="username" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;margin-bottom:10px">'
          +'<input name=p type=password required placeholder="Password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;margin-bottom:10px">'
          +'<div class=err style="color:#dc2626;font-size:13px;min-height:18px;margin-bottom:8px"></div>'
          +'<button style="width:100%;padding:12px;border:0;border-radius:10px;background:#0f766e;color:#fff;font-size:15px;font-weight:600;cursor:pointer">Sign in</button></form>';
        document.body.appendChild(w);
        var f=w.querySelector('form'),err=w.querySelector('.err'),b=w.querySelector('button');
        f.onsubmit=async function(ev){
          ev.preventDefault();err.textContent='';b.disabled=true;b.textContent='Signing in…';
          var x=await s.auth.signInWithPassword({email:f.e.value.trim(),password:f.p.value});
          if(x.error||!x.data.session){err.textContent=(x.error&&x.error.message)||'Sign in failed';b.disabled=false;b.textContent='Sign in';return}
          w.remove();resolve(x.data.session);
        };
      });
    });
  }

  window.AmaanCloud={
    configured:configured,
    start:async function(){
      var session=await gate();uid=session.user.id;
      client().auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT')location.reload()});
      listen();
      var db=makeDb();db.email=session.user.email;return db;
    },
    signOut:async function(){try{await client().auth.signOut()}catch(e){}location.reload()}
  };
})();
