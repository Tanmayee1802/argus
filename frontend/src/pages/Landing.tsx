import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'

export default function Landing() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const navigate  = useNavigate()

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let W = window.innerWidth, H = window.innerHeight

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 1)
    renderer.setSize(W, H)

    const scene = new THREE.Scene()
    const cam   = new THREE.PerspectiveCamera(52, W / H, 0.1, 100)
    cam.position.set(0, 1.1, 3.8)
    cam.lookAt(0, 0, 0)

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight
      renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    const mat = new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      vertexShader:   `attribute float size;varying vec3 vColor;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*(46.0/-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vColor;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.5)discard;float a=smoothstep(.5,.28,d);gl_FragColor=vec4(vColor,a);}`,
    })

    const ehMesh = new THREE.Mesh(new THREE.SphereGeometry(0.60,48,48), new THREE.MeshBasicMaterial({color:0x000000}))
    scene.add(ehMesh)
    const prMesh = new THREE.Mesh(new THREE.TorusGeometry(0.635,0.018,8,120), new THREE.MeshBasicMaterial({color:0x00eeff}))
    scene.add(prMesh)

    const P = { inner:[0.0,0.9,0.7], outer:[0.0,0.22,0.16] }
    const bhR = 0.68
    const DN = 3000
    const dAngles=new Float32Array(DN), dRadii=new Float32Array(DN)
    const dSpeeds=new Float32Array(DN), dInfall=new Float32Array(DN)
    const dvx=new Float32Array(DN), dvz=new Float32Array(DN)
    const dp=new Float32Array(DN*3), dc=new Float32Array(DN*3), ds=new Float32Array(DN)

    for(let i=0;i<DN;i++){
      dAngles[i]=Math.random()*Math.PI*2
      dRadii[i]=0.68+Math.pow(Math.random(),0.55)*1.5
      dSpeeds[i]=0.005+Math.random()*0.007
      dInfall[i]=0.00028+Math.random()*0.00032
      ds[i]=0.50+Math.random()*0.36
      dp[i*3]=Math.cos(dAngles[i])*dRadii[i]
      dp[i*3+1]=(Math.random()-.5)*(0.016+dRadii[i]*0.018)*2
      dp[i*3+2]=Math.sin(dAngles[i])*dRadii[i]
      const t=Math.max(0,Math.min(1,(dRadii[i]-0.68)/1.5))
      const hot=1-t, b=0.38+hot*0.62
      dc[i*3]=(P.inner[0]*hot+P.outer[0]*(1-hot))*b
      dc[i*3+1]=(P.inner[1]*hot+P.outer[1]*(1-hot))*b
      dc[i*3+2]=(P.inner[2]*hot+P.outer[2]*(1-hot))*b
    }
    const dgeo=new THREE.BufferGeometry()
    dgeo.setAttribute('position',new THREE.BufferAttribute(dp,3))
    dgeo.setAttribute('color',   new THREE.BufferAttribute(dc,3))
    dgeo.setAttribute('size',    new THREE.BufferAttribute(ds,1))
    const disk=new THREE.Points(dgeo,mat)
    disk.rotation.x=0.25
    scene.add(disk)

    const LN=400
    const lp2=new Float32Array(LN*3),lc2=new Float32Array(LN*3),ls2=new Float32Array(LN)
    for(let i=0;i<LN;i++){
      const a=(i/LN)*Math.PI*2
      const r=0.72+Math.random()*0.65
      const bend=Math.abs(Math.sin(a))*0.65+0.32+(Math.random()-.5)*0.06
      lp2[i*3]=Math.cos(a)*r*0.92; lp2[i*3+1]=bend; lp2[i*3+2]=Math.sin(a)*r*0.22
      lc2[i*3]=0;lc2[i*3+1]=0.5;lc2[i*3+2]=0.38; ls2[i]=0.18+Math.random()*0.16
    }
    const lgeo=new THREE.BufferGeometry()
    lgeo.setAttribute('position',new THREE.BufferAttribute(lp2,3))
    lgeo.setAttribute('color',   new THREE.BufferAttribute(lc2,3))
    lgeo.setAttribute('size',    new THREE.BufferAttribute(ls2,1))
    scene.add(new THREE.Points(lgeo,mat))

    function mkRing(n:number,rad:number,tiltX:number,tiltZ:number,col:number[]){
      const rp=new Float32Array(n*3),rc=new Float32Array(n*3),rs=new Float32Array(n)
      let idx=0
      for(let i=0;i<n;i++){
        const a=(i/n)*Math.PI*2
        const density=0.38+0.40*Math.sin(a*4+1.0)+0.22*Math.sin(a*9+2.1)
        if(Math.random()>density) continue
        const r=rad+(Math.random()-.5)*rad*0.13
        rp[idx*3]=Math.cos(a)*r
        rp[idx*3+1]=Math.sin(a)*r*Math.sin(tiltX)+(Math.random()-.5)*0.03
        rp[idx*3+2]=Math.sin(a)*r*Math.cos(tiltX)+Math.cos(a)*r*tiltZ*0.05
        rc[idx*3]=col[0];rc[idx*3+1]=col[1];rc[idx*3+2]=col[2]
        rs[idx]=0.44+Math.random()*0.32; idx++
      }
      const g=new THREE.BufferGeometry()
      g.setAttribute('position',new THREE.BufferAttribute(rp.slice(0,idx*3),3))
      g.setAttribute('color',   new THREE.BufferAttribute(rc.slice(0,idx*3),3))
      g.setAttribute('size',    new THREE.BufferAttribute(rs.slice(0,idx),1))
      const m=new THREE.Points(g,mat); scene.add(m); return m
    }

    const ring1=mkRing(2800,2.55, 0.22,0.10,[0.0,0.82,0.60])
    const ring2=mkRing(2000,3.20,-0.38,0.15,[0.0,0.46,0.78])
    const ring3=mkRing(1200,3.90, 0.50,0.08,[0.0,0.30,0.58])
    const ring4=mkRing( 700,4.60,-0.28,0.12,[0.0,0.18,0.40])

    const SN=200,sp=new Float32Array(SN*3),sc=new Float32Array(SN*3),ss=new Float32Array(SN)
    for(let i=0;i<SN;i++){
      sp[i*3]=(Math.random()-.5)*32;sp[i*3+1]=(Math.random()-.5)*26;sp[i*3+2]=(Math.random()-.5)*8-6
      const b=0.2+Math.random()*0.55;sc[i*3]=b;sc[i*3+1]=b;sc[i*3+2]=b;ss[i]=0.10+Math.random()*0.14
    }
    const sg=new THREE.BufferGeometry()
    sg.setAttribute('position',new THREE.BufferAttribute(sp,3))
    sg.setAttribute('color',   new THREE.BufferAttribute(sc,3))
    sg.setAttribute('size',    new THREE.BufferAttribute(ss,1))
    scene.add(new THREE.Points(sg,mat))

    let mwx=999,mwz=999
    const onMove=(e:MouseEvent)=>{mwx=((e.clientX/W)-0.5)*6.5;mwz=((e.clientY/H)-0.5)*3.5}
    const onLeave=()=>{mwx=999;mwz=999}
    window.addEventListener('mousemove',onMove)
    window.addEventListener('mouseleave',onLeave)

    let tt=0,animId=0
    const REPEL_R=1.0,REPEL_F=0.030,DAMP=0.88

    const animate=()=>{
      animId=requestAnimationFrame(animate); tt+=0.004
      const dpos=dgeo.attributes.position as THREE.BufferAttribute
      const dcol=dgeo.attributes.color   as THREE.BufferAttribute
      for(let i=0;i<DN;i++){
        dAngles[i]+=dSpeeds[i]*(1.2/Math.max(dRadii[i],0.5))
        dRadii[i]-=dInfall[i]*(1+Math.max(0,(2.0-dRadii[i])*1.5))
        if(dRadii[i]<bhR){dRadii[i]=1.8+Math.random()*1.2;dAngles[i]=Math.random()*Math.PI*2;dvx[i]=0;dvz[i]=0}
        let wx=Math.cos(dAngles[i])*dRadii[i], wz=Math.sin(dAngles[i])*dRadii[i]
        const ddx=wx-mwx,ddz=wz-mwz,dist=Math.sqrt(ddx*ddx+ddz*ddz)
        if(dist<REPEL_R&&dist>0.01){const f=REPEL_F*(1-dist/REPEL_R);dvx[i]+=(ddx/dist)*f;dvz[i]+=(ddz/dist)*f}
        dvx[i]*=DAMP;dvz[i]*=DAMP
        dpos.array[i*3]=wx+dvx[i]; dpos.array[i*3+1]=(Math.random()-.5)*(0.016+dRadii[i]*0.018)*2; dpos.array[i*3+2]=wz+dvz[i]
        const hot=1-Math.max(0,Math.min(1,(dRadii[i]-bhR)/1.5)),b=0.38+hot*0.62
        dcol.array[i*3]=(P.inner[0]*hot+P.outer[0]*(1-hot))*b
        dcol.array[i*3+1]=(P.inner[1]*hot+P.outer[1]*(1-hot))*b
        dcol.array[i*3+2]=(P.inner[2]*hot+P.outer[2]*(1-hot))*b
      }
      dpos.needsUpdate=true;dcol.needsUpdate=true
      disk.rotation.y=tt*0.32
      ring1.rotation.y=tt*0.16;ring1.rotation.x=0.22
      ring2.rotation.y=-tt*0.11;ring2.rotation.z=tt*0.03
      ring3.rotation.y=tt*0.07;ring3.rotation.x=-0.35
      ring4.rotation.y=-tt*0.05;ring4.rotation.z=-tt*0.02
      renderer.render(scene,cam)
    }
    animate()

    return()=>{
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove',onMove)
      window.removeEventListener('mouseleave',onLeave)
      window.removeEventListener('resize',onResize)
      renderer.dispose()
    }
  },[])

  return (
    <div style={{position:'fixed',inset:0,background:'#000',overflow:'hidden'}}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>

      {/* Top badge */}
      <div style={{position:'absolute',top:20,left:'50%',transform:'translateX(-50%)',fontFamily:'Share Tech Mono',fontSize:10,letterSpacing:5,color:'rgba(0,220,255,0.22)',pointerEvents:'none',whiteSpace:'nowrap'}}>
        SUI OVERFLOW 2026 · AGENTIC WEB TRACK · SUB-TRACK 1
      </div>

      {/* Soft dark vignette ONLY behind text — no box, just a radial fade */}
      <div style={{
        position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:'900px', height:'340px',
        background:'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 50%, transparent 100%)',
        pointerEvents:'none',
      }}/>

      {/* Text — floats over the vignette */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'0 0 26px'}}>
        <div style={{height:'36vh'}}/>

        <h1 style={{fontFamily:'Orbitron,monospace',fontSize:82,fontWeight:900,letterSpacing:22,color:'#fff',margin:0,textShadow:'0 0 30px rgba(0,255,200,0.6), 0 0 60px rgba(0,255,200,0.2)'}}>
          ARGUS
        </h1>
        <p style={{fontFamily:'Share Tech Mono',fontSize:12,letterSpacing:5,color:'rgba(0,220,255,1.0)',margin:0,textShadow:'0 0 20px rgba(0,220,255,0.5)'}}>
          THE ALL-SEEING AUTONOMOUS RISK GUARDIAN FOR SUI DEFI
        </p>
        <p style={{fontFamily:'Share Tech Mono',fontSize:11,letterSpacing:3,color:'rgba(255,255,255,0.82)',margin:0}}>
          100 EYES · NEVER SLEEPS · ACTS BEFORE THE DAMAGE IS DONE
        </p>

        <div style={{display:'flex',gap:14,marginTop:10}}>
          <button onClick={()=>navigate('/dashboard')}
            style={{fontFamily:'Share Tech Mono',fontSize:12,letterSpacing:4,padding:'12px 32px',border:'1px solid rgba(0,255,200,0.6)',background:'rgba(0,255,200,0.12)',color:'#00ffc8',transition:'all 0.3s',textShadow:'0 0 10px rgba(0,255,200,0.4)'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,255,200,0.22)';e.currentTarget.style.boxShadow='0 0 24px rgba(0,255,200,0.25)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,255,200,0.12)';e.currentTarget.style.boxShadow='none'}}>
            ENTER DASHBOARD →
          </button>
          <a href="https://suiexplorer.com/object/0x1fb3180e24c981f523d89bb78c638c6be1019c7d619f19708f2bd23c8f99cf6f?network=testnet"
            target="_blank" rel="noreferrer"
            style={{fontFamily:'Share Tech Mono',fontSize:12,letterSpacing:4,padding:'12px 32px',border:'1px solid rgba(255,255,255,0.40)',background:'transparent',color:'rgba(255,255,255,0.82)',textDecoration:'none',transition:'all 0.3s'}}
            onMouseEnter={e=>(e.currentTarget.style.color='#fff')}
            onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.82)')}>
            VIEW ON SUI →
          </a>
        </div>

        <div style={{display:'flex',gap:60,marginTop:8}}>
          {[{val:'4',label:'MOVE MODULES'},{val:'5',label:'RISK FACTORS'},{val:'2-of-3',label:'DAO MULTISIG'},{val:'WALRUS',label:'MODEL STORAGE'}].map(s=>(
            <div key={s.label} style={{textAlign:'center'}}>
              <div style={{fontFamily:'Orbitron',fontSize:17,fontWeight:700,color:'#fff',letterSpacing:2,textShadow:'0 0 15px rgba(0,255,200,0.35)'}}>{s.val}</div>
              <div style={{fontFamily:'Share Tech Mono',fontSize:9,letterSpacing:3,color:'rgba(0,220,255,0.8)',marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
