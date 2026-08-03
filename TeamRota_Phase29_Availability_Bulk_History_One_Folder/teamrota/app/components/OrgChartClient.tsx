"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Mail, Phone, GitBranch } from "lucide-react";

export type Person = {
  id: string;
  full_name: string | null;
  job_title: string | null;
  position_title: string | null;
  department_name: string | null;
  manager_id: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
};

export type ReportingLine = {
  id: string;
  employee_id: string;
  manager_id: string;
  label: string | null;
  relationship_type: string;
  active: boolean;
};

type Line = { id: string; x1: number; y1: number; x2: number; y2: number; label: string };

function Node({ person, people, reportingLines, expanded, setExpanded, ancestry = new Set<string>() }: { person: Person; people: Person[]; reportingLines: ReportingLine[]; expanded: Set<string>; setExpanded: (next: Set<string>) => void; ancestry?: Set<string>; }) {
  const nextAncestry = new Set(ancestry); nextAncestry.add(person.id);
  const children = people.filter((item) => item.manager_id === person.id && !nextAncestry.has(item.id));
  const dottedManagers = reportingLines.filter((line) => line.employee_id === person.id && line.active).map((line) => ({ ...line, manager: people.find((candidate) => candidate.id === line.manager_id) })).filter((line) => line.manager);
  const open = expanded.has(person.id);
  function toggle() { const next = new Set(expanded); if (open) next.delete(person.id); else next.add(person.id); setExpanded(next); }
  return <li className="tree-node">
    <article className="org-person" data-person-id={person.id}>
      {person.photo_url ? <img src={person.photo_url} alt={person.full_name || "Employee"} className="org-photo" /> : <div className="avatar">{person.full_name?.[0] || "E"}</div>}
      <strong>{person.full_name}</strong><span>{person.position_title || person.job_title || "Position not assigned"}</span><small>{person.department_name || "Department not assigned"}</small>
      {person.email && <a href={`mailto:${person.email}`}><Mail size={13}/>{person.email}</a>}{person.phone && <a href={`tel:${person.phone}`}><Phone size={13}/>{person.phone}</a>}
      {dottedManagers.length > 0 && <div className="dotted-reporting-list" aria-label="Secondary reporting lines">{dottedManagers.map((line) => <div className="dotted-reporting-item" key={line.id}><GitBranch size={13}/><span>{line.label || "Secondary report"}: <b>{line.manager?.full_name}</b></span></div>)}</div>}
      {children.length > 0 && <button className="org-toggle" type="button" onClick={toggle}>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>} {open ? "Minimize" : "Expand"} ({children.length})</button>}
    </article>
    {children.length > 0 && open && <ul>{children.map((child) => <Node key={child.id} person={child} people={people} reportingLines={reportingLines} expanded={expanded} setExpanded={setExpanded} ancestry={nextAncestry}/>)}</ul>}
  </li>;
}

export default function OrgChartClient({ people, reportingLines }: { people: Person[]; reportingLines: ReportingLine[]; }) {
  const roots = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person]));
    const normalRoots = people.filter((person) => !person.manager_id || !byId.has(person.manager_id));
    const reachable = new Set<string>();
    const walk = (id: string) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      people.filter((p) => p.manager_id === id).forEach((p) => walk(p.id));
    };
    normalRoots.forEach((root) => walk(root.id));
    const disconnected = people.filter((person) => !reachable.has(person.id));
    return [...normalRoots, ...disconnected.filter((person, index) => disconnected.findIndex((p) => p.id === person.id) === index)];
  }, [people]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(people.map((person) => person.id)));
  const [lines, setLines] = useState<Line[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function calculate() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const next: Line[] = [];
      for (const relation of reportingLines.filter((line) => line.active)) {
        const manager = canvas.querySelector<HTMLElement>(`[data-person-id="${relation.manager_id}"]`);
        const employee = canvas.querySelector<HTMLElement>(`[data-person-id="${relation.employee_id}"]`);
        if (!manager || !employee) continue;
        const m = manager.getBoundingClientRect(); const e = employee.getBoundingClientRect();
        next.push({ id: relation.id, x1: m.left + m.width / 2 - bounds.left + canvas.scrollLeft, y1: m.bottom - bounds.top + canvas.scrollTop, x2: e.left + e.width / 2 - bounds.left + canvas.scrollLeft, y2: e.top - bounds.top + canvas.scrollTop, label: relation.label || "Secondary reporting" });
      }
      setLines(next);
    }
    const timer = window.setTimeout(calculate, 60);
    window.addEventListener("resize", calculate);
    const observer = new ResizeObserver(calculate);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", calculate); observer.disconnect(); };
  }, [people, reportingLines, expanded]);

  return <>
    <div className="org-toolbar"><button onClick={() => setExpanded(new Set(people.map((person) => person.id)))}>Expand all</button><button onClick={() => setExpanded(new Set())}>Minimize all</button><span className="org-line-legend"><i className="solid-line-sample"/>Primary reporting</span><span className="org-line-legend"><i className="dotted-line-sample"/>Secondary reporting</span></div>
    <div className="org-chart-canvas" ref={canvasRef}>
      <svg className="org-secondary-lines" aria-hidden="true" style={{ width: Math.max(1600, ...lines.flatMap(l=>[l.x1,l.x2])) + 80, height: Math.max(600, ...lines.flatMap(l=>[l.y1,l.y2])) + 80 }}>
        {lines.map((line) => { const mid = (line.y1 + line.y2) / 2; return <g key={line.id}><path d={`M ${line.x1} ${line.y1} C ${line.x1} ${mid}, ${line.x2} ${mid}, ${line.x2} ${line.y2}`} /><circle cx={line.x1} cy={line.y1} r="3"/><circle cx={line.x2} cy={line.y2} r="3"/><title>{line.label}</title></g>; })}
      </svg>
      <ul className="org-tree">{roots.map((root) => <Node key={root.id} person={root} people={people} reportingLines={reportingLines} expanded={expanded} setExpanded={setExpanded} ancestry={new Set<string>()}/>)}</ul>
    </div>
  </>;
}
