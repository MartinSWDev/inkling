const { chromium, devices } = require('playwright'); const startCast=require('/home/claude/launch/capture/cast.cjs');
const [w,h]=[+(process.argv[2]||360),+(process.argv[3]||640)];
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],viewport:{width:w,height:h},deviceScaleFactor:2});
const p=await ctx.newPage(); const errs=[];p.on('pageerror',e=>errs.push(e.message));
const posts=[];p.on('request',r=>{if(r.url().includes('/api/feedback'))posts.push(r.method()+' '+r.postData().slice(0,140))});
p.on('response',r=>{if(r.url().includes('/api/feedback'))posts.push('-> '+r.status())});
const W=ms=>p.waitForTimeout(ms);
const names=async()=>p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.width&&r.bottom>0&&r.top<innerHeight}).map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim()));
const click=async(re)=>{const l=p.getByRole('button',{name:re});if(await l.count()){await l.first().click({force:true});return true}return false};
await p.goto('http://127.0.0.1:8788/'); await W(1500);
await click(/find my subjects/i); await W(2500); await click(/let's go/i); await W(3000);
for (const s of ['Maths','Physics','Computing']) {await p.getByText(s,{exact:true}).tap(); await W(300);}
let last='';
for(let step=0;step<80;step++){
  const ns=await names(); const key=ns.join('|');
  if(ns.some(x=>/build my room/i.test(x))){await click(/build my room/i);await W(3500);continue}
  if(ns.some(x=>/see my subjects/i.test(x))){break}
  if(ns.some(x=>/^continue$/i.test(x))){await click(/^continue$/i);await W(3200);continue}
  if(ns.some(x=>/^yes$/i.test(x))){await click(step%3?/^yes$/i:/not for me/i);await W(1000);continue}
  if(ns.some(x=>/can't decide/i.test(x))){const bs=p.locator('button').filter({hasNotText:/can't decide|sound/i});await bs.nth(step%2).click({force:true});await W(1300);continue}
  await W(1500); if(key===last){console.log('stuck',key);break} last=key;
}
await click(/see my subjects/i); await W(3800);
await p.screenshot({path:'/home/claude/launch/public/fb_ask.png'});
const bb=await p.getByRole('button',{name:'Yes, it feels like me'}).boundingBox(); console.log('BTN',JSON.stringify(bb));
await p.getByRole('button',{name:'Yes, it feels like me'}).click(); await W(1200);
await p.screenshot({path:'/home/claude/launch/public/fb_thanks.png'});
console.log('POSTS',JSON.stringify(posts)); await b.close();})();
