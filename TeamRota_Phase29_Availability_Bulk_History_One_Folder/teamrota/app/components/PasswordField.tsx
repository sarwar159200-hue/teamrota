"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
export default function PasswordField({name="password",placeholder="Temporary password *"}:{name?:string;placeholder?:string}){
  const [show,setShow]=useState(false);
  return <div className="password-field"><input name={name} type={show?"text":"password"} minLength={8} placeholder={placeholder} required/><button type="button" aria-label={show?"Hide password":"Show password"} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
}
