const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const img=n=>{const i=new Image();i.src="assets/"+n+".png";return i};
const textures={grass:img("grass"),dirt:img("dirt"),stone:img("stone"),wood:img("wood"),leaves:img("leaves"),amethyst:img("amethyst"),sand:img("sand")};
const items={pickaxe:img("pickaxe"),amethyst:img("amethyst"),heart:img("heart")};

let W=innerWidth,H=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
function resize(){W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener("resize",resize);resize();

const TILE=32,WORLD_W=220,WORLD_H=80;
let world=[];
let seed=Math.floor(Math.random()*999999);
let selected=0;
let inventory={dirt:32,stone:8,wood:16,leaves:8,amethyst:0,sand:20};
const hot=["dirt","stone","wood","leaves","amethyst","sand"];
let keys={};
let mouse={x:0,y:0,down:false,button:0};
let camera={x:0,y:0};
let player={x:0,y:0,vx:0,vy:0,w:22,h:30,onGround:false,health:10};
let cycle=0.23;

function rnd(x){const n=Math.sin(x*127.1+seed*0.17)*43758.5453;return n-Math.floor(n)}
function makeWorld(){
  world=Array.from({length:WORLD_H},()=>Array(WORLD_W).fill(0));
  let h=32;
  for(let x=0;x<WORLD_W;x++){
    h+=Math.floor((rnd(x)-.5)*3);
    h=Math.max(22,Math.min(40,h));
    for(let y=h;y<WORLD_H;y++){
      world[y][x]=y===h?"grass":y<h+4?"dirt":y<WORLD_H-6?"stone":"stone";
    }
    if(rnd(x*3.7)>.83 && x>4 && x<WORLD_W-5){
      const trunk=3+Math.floor(rnd(x*8)*3);
      for(let y=h-1;y>=h-trunk;y--) world[y][x]="wood";
      for(let yy=-3;yy<=1;yy++) for(let xx=-2;xx<=2;xx++) if(Math.abs(xx)+Math.abs(yy)<4 && h-trunk+yy>=0) world[h-trunk+yy][x+xx]="leaves";
    }
    if(rnd(x*13.2)>.965) world[h][x]="sand";
  }
  for(let i=0;i<90;i++){
    const x=2+Math.floor(rnd(i*9.2)* (WORLD_W-4));
    const y=45+Math.floor(rnd(i*15.1)*28);
    world[y][x]="amethyst";
    if(rnd(i*3)>0.45) world[y][x+1]="amethyst";
    if(rnd(i*7)>0.65) world[y-1][x]="amethyst";
  }
  const spawnX=Math.floor(WORLD_W/2);
  let sy=0;for(let y=0;y<45;y++)if(world[y][spawnX]){sy=y;break}
  player.x=spawnX*TILE;player.y=(sy-2)*TILE;player.vx=player.vy=0
}
makeWorld();

const typeColor={};
function solid(t){return !!t}
function drawTexture(t,x,y){const im=textures[t];if(im.complete&&im.naturalWidth)ctx.drawImage(im,x,y,TILE,TILE);else{ctx.fillStyle=typeColor[t]||"#888";ctx.fillRect(x,y,TILE,TILE)}}

function visibleBounds(){
  return {x0:Math.max(0,Math.floor(camera.x/TILE)-2),x1:Math.min(WORLD_W-1,Math.ceil((camera.x+W)/TILE)+2),
    y0:Math.max(0,Math.floor(camera.y/TILE)-2),y1:Math.min(WORLD_H-1,Math.ceil((camera.y+H)/TILE)+2)}
}
function collides(px,py,pw,ph){
  const x0=Math.floor(px/TILE),x1=Math.floor((px+pw-1)/TILE);
  const y0=Math.floor(py/TILE),y1=Math.floor((py+ph-1)/TILE);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(y>=0&&y<WORLD_H&&x>=0&&x<WORLD_W&&solid(world[y][x]))return true;
  return false
}
function move(dt){
  let ax=0;if(keys.a||keys.ArrowLeft)ax=-1;if(keys.d||keys.ArrowRight)ax=1;
  player.vx+=(ax*0.55);player.vx*=ax?0.86:0.76;player.vx=Math.max(-5,Math.min(5,player.vx));
  player.vy+=0.42;player.vy=Math.min(player.vy,11);
  if((keys[" "]||keys.w||keys.ArrowUp)&&player.onGround){player.vy=-8.7;player.onGround=false}
  let nx=player.x+player.vx;
  if(!collides(nx,player.y,player.w,player.h))player.x=nx;else player.vx=0;
  let ny=player.y+player.vy;
  if(!collides(player.x,ny,player.w,player.h)){player.y=ny;player.onGround=false}
  else{if(player.vy>0)player.onGround=true;player.vy=0}
  if(player.y>WORLD_H*TILE){player.health=Math.max(0,player.health-1);player.x=Math.floor(WORLD_W/2)*TILE;player.y=4*TILE}
}
function camUpdate(){
  const tx=player.x+player.w/2-W/2,ty=player.y+player.h/2-H/2;
  camera.x+=(Math.max(0,Math.min(WORLD_W*TILE-W,tx))-camera.x)*.12;
  camera.y+=(Math.max(0,Math.min(WORLD_H*TILE-H,ty))-camera.y)*.12;
}
function screenToWorld(sx,sy){return{x:Math.floor((sx+camera.x)/TILE),y:Math.floor((sy+camera.y)/TILE)}}
function inReach(t){const px=player.x+player.w/2,py=player.y+player.h/2;const tx=t.x*TILE+16,ty=t.y*TILE+16;return Math.hypot(tx-px,ty-py)<TILE*5}
function action(){
  if(!mouse.down||mouse.button>2)return;
  const t=screenToWorld(mouse.x,mouse.y);if(t.x<0||t.y<0||t.x>=WORLD_W||t.y>=WORLD_H||!inReach(t))return;
  if(mouse.button===0){
    if(world[t.y][t.x]){const type=world[t.y][t.x];world[t.y][t.x]=0;if(type!=="grass")inventory[type]=(inventory[type]||0)+1;else inventory.dirt=(inventory.dirt||0)+1}
  }else if(mouse.button===2){
    const item=hot[selected];if((inventory[item]||0)>0&&!world[t.y][t.x]&&!(player.x<=(t.x+1)*TILE&&player.x+player.w>=t.x*TILE&&player.y<=(t.y+1)*TILE&&player.y+player.h>=t.y*TILE)){world[t.y][t.x]=item;inventory[item]--}
  }
}
addEventListener("keydown",e=>{keys[e.key]=true;if(e.key>="1"&&e.key<="6")selected=+e.key-1;updateHotbar()});
addEventListener("keyup",e=>keys[e.key]=false);
canvas.addEventListener("mousemove",e=>{mouse.x=e.clientX;mouse.y=e.clientY});
canvas.addEventListener("mousedown",e=>{e.preventDefault();mouse.button=e.button;mouse.down=true;action()});
addEventListener("mouseup",()=>mouse.down=false);
canvas.addEventListener("contextmenu",e=>e.preventDefault());

function sky(){
  const t=(Math.sin(cycle*Math.PI*2-Math.PI/2)+1)/2;
  const r=Math.floor(31+105*t),g=Math.floor(43+120*t),b=Math.floor(68+143*t);
  ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(0,0,W,H);
  const sunX=W*(cycle<.5?cycle*2:2-cycle*2),sunY=H*.18+Math.sin(cycle*Math.PI*2)*H*.05;
  ctx.fillStyle=`rgba(255,244,194,${.3+.7*t})`;ctx.beginPath();ctx.arc(sunX,sunY,28,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=`rgba(9,12,27,${(1-t)*.65})`;ctx.fillRect(0,0,W,H);
}
function draw(){
  sky();
  const b=visibleBounds();
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){const t=world[y][x];if(t)drawTexture(t,x*TILE-camera.x,y*TILE-camera.y)}
  const px=player.x-camera.x,py=player.y-camera.y;
  ctx.fillStyle="#3a2b1d";ctx.fillRect(px+2,py+10,player.w-4,player.h-10);
  ctx.fillStyle="#d4a579";ctx.fillRect(px+4,py,14,16);
  ctx.fillStyle="#23202b";ctx.fillRect(px+4,py+3,14,4);ctx.fillRect(px+3,py+9,4,2);
  ctx.fillStyle="#fff";ctx.fillRect(px+7,py+6,2,3);ctx.fillRect(px+14,py+6,2,3);
  const t=screenToWorld(mouse.x,mouse.y);
  if(t.x>=0&&t.y>=0&&t.x<WORLD_W&&t.y<WORLD_H&&inReach(t)){ctx.strokeStyle="rgba(255,255,255,.8)";ctx.lineWidth=2;ctx.strokeRect(t.x*TILE-camera.x+1,t.y*TILE-camera.y+1,TILE-2,TILE-2)}
}
function updateHud(){
  const h=document.getElementById("hearts");h.innerHTML="";for(let i=0;i<10;i++){const im=new Image();im.src="assets/heart.png";im.className="heart";im.style.opacity=i<player.health?"1":".2";h.appendChild(im)}
  document.getElementById("coords").textContent=`X ${Math.floor(player.x/TILE)}  Y ${Math.floor(player.y/TILE)}`;
  const hour=Math.floor((cycle*24+6)%24),min=Math.floor((((cycle*24+6)%24)%1)*60);
  document.getElementById("time").textContent=`${String(hour).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
}
function updateHotbar(){const el=document.getElementById("hotbar");el.innerHTML="";hot.forEach((k,i)=>{const d=document.createElement("div");d.className="slot"+(i===selected?" active":"");const key=document.createElement("span");key.className="key";key.textContent=i+1;d.appendChild(key);const im=document.createElement("img");im.src=`assets/${k}.png`;d.appendChild(im);const c=document.createElement("span");c.className="count";c.textContent=inventory[k]||0;d.appendChild(c);el.appendChild(d)})}
document.getElementById("reset").onclick=()=>{seed=Math.floor(Math.random()*999999);inventory={dirt:32,stone:8,wood:16,leaves:8,amethyst:0,sand:20};player.health=10;makeWorld();updateHotbar()};
updateHotbar();

let last=performance.now(),cool=0;
function loop(now){
  const dt=Math.min(32,now-last);last=now;
  move(dt/16.67);camUpdate();cool-=dt;
  if(mouse.down&&cool<=0){action();cool=110}
  cycle=(cycle+dt/180000)%1;
  draw();updateHud();requestAnimationFrame(loop)
}
requestAnimationFrame(loop);
