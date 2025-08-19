'use client';
import React,{useEffect,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Bot, User } from 'lucide-react';

type KBItem={name:string;content:string};
type Msg={role:'user'|'ai';text:string};

export default function Chat(){
 const [msgs,setMsgs]=useState<Msg[]>([{role:'ai',text:'Привет! Пример формулы: $e^{i\\pi}+1=0$'}]);
 const [text,setText]=useState('');
 const [recording,setRecording]=useState(false);
 const [useWebSpeech,setUseWebSpeech]=useState(true);
 const [sessionKB,setSessionKB]=useState<KBItem[]>([]);
 const chatRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{chatRef.current?.scrollTo({top:chatRef.current.scrollHeight,behavior:'smooth'})},[msgs]);

 async function send(t:string){
  const next=[...msgs,{role:'user' as const,text:t}];setMsgs(next);setText('');
  const kb=sessionKB.slice(0,8).map(d=>({name:d.name,content:d.content.slice(0,4000)}));
  const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,kb})});
  const data=await r.json();
  setMsgs(m=>[...m,{role:'ai',text:String(data.reply||'')}]);
 }

 useEffect(()=>{
  function onDragOver(e:DragEvent){e.preventDefault();}
  async function onDrop(e:DragEvent){e.preventDefault(); if(!e.dataTransfer)return;
    const files=Array.from(e.dataTransfer.files||[]);
    const texts:KBItem[]=[];
    for(const f of files){const t=await f.text();texts.push({name:f.name,content:t});}
    setSessionKB(p=>[...p,...texts]);
    setMsgs(m=>[...m,{role:'ai',text:`📚 Загружено файлов: ${files.length}`}]);
  }
  document.addEventListener('dragover',onDragOver);
  document.addEventListener('drop',onDrop);
  return ()=>{document.removeEventListener('dragover',onDragOver);document.removeEventListener('drop',onDrop)};
 },[]);

 const recogRef=useRef<any>(null);
 async function toggleMic(){
  const hasSR=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
  if(useWebSpeech&&hasSR){
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!recogRef.current){
      const rec=new SR(); rec.lang='ru-RU'; rec.interimResults=true; rec.maxAlternatives=1;
      rec.onresult=(ev:any)=>{ let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){const tr=ev.results[i][0].transcript; if(ev.results[i].isFinal) setText(t=>(t+' '+tr).trim()); else interim+=tr;} setRecording(!!interim); };
      rec.onerror=()=>setRecording(false); rec.onend=()=>setRecording(false); recogRef.current=rec;
    }
    if(!recording){recogRef.current.start();setRecording(true);} else {recogRef.current.stop();setRecording(false);}
  }else{
    if(!navigator.mediaDevices?.getUserMedia){alert('Микрофон недоступен.');return;}
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mr=new MediaRecorder(stream); const chunks:BlobPart[]=[];
    mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)};
    mr.onstop=async()=>{const blob=new Blob(chunks,{type:'audio/webm'});const fd=new FormData();fd.append('audio',blob,'rec.webm');const r=await fetch('/api/transcribe',{method:'POST',body:fd});const data=await r.json();if(data.text)setText(t=>(t+' '+data.text).trim());};
    if(!recording){mr.start();setRecording(true);} else {mr.stop();setRecording(false);}
  }
 }

 return (<div id='app'>
   <header>
     <h1>Ваш ассистент</h1>
     <div style={{display:'flex',gap:12,alignItems:'center'}}>
       <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12,color:'#9aa3c7'}}>
         <input type='checkbox' checked={useWebSpeech} onChange={e=>setUseWebSpeech(e.target.checked)} />
         <span>Распознавание в браузере</span>
       </label>
       <span className='kb-chip'>KB: {sessionKB.length}</span>
     </div>
   </header>

   <main ref={chatRef} className='chat'>
     {msgs.map((m,i)=>(
       <div key={i} className={`msg ${m.role}`}>
         <div className='avatar'>{m.role==='user'?<User size={18}/>:<Bot size={18}/>}</div>
         <div className='bubble'>
           <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
             {m.text}
           </ReactMarkdown>
         </div>
       </div>
     ))}
   </main>

   <footer>
     <form className='form' onSubmit={e=>{e.preventDefault(); if(text.trim()) send(text.trim())}}>
       <button type='button' className='btn' onClick={toggleMic} title='Голосовой ввод'>{recording?'⏺':'🎙'}</button>
       <input className='input' value={text} onChange={e=>setText(e.target.value)} placeholder='Спросите что-нибудь… Формулы: $e^{i\\pi}+1=0$' />
       <button type='submit' className='btn'>Отправить</button>
     </form>
   </footer>
 </div>);
}