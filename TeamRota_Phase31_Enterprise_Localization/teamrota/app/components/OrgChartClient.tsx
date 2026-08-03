"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Mail,
  Maximize2,
  Minus,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";

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

type Connector = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};

function EmployeeCard({
  person,
  directCount,
  secondaryManagers,
  expanded,
  onToggle,
  isMatch,
}: {
  person: Person;
  directCount: number;
  secondaryManagers: Array<{ id: string; name: string; label: string }>;
  expanded: boolean;
  onToggle: () => void;
  isMatch: boolean;
}) {
  return (
    <article
      className={`org-person premium-org-card${isMatch ? " org-search-match" : ""}`}
      data-person-id={person.id}
    >
      <div className="org-card-topline">
        <span className="org-card-department">
          <Building2 size={12} /> {person.department_name || "No department"}
        </span>
        {directCount > 0 && <span className="org-report-count">{directCount} reports</span>}
      </div>

      <div className="org-profile-row">
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.full_name || "Employee"} className="org-photo" />
        ) : (
          <div className="avatar org-avatar">{person.full_name?.[0] || "E"}</div>
        )}
        <div className="org-profile-copy">
          <strong>{person.full_name || "Unnamed employee"}</strong>
          <span>{person.position_title || person.job_title || "Position not assigned"}</span>
        </div>
      </div>

      <div className="org-contact-row">
        {person.email && (
          <a href={`mailto:${person.email}`} title={person.email}>
            <Mail size={13} /> <span>{person.email}</span>
          </a>
        )}
        {person.phone && (
          <a href={`tel:${person.phone}`} title={person.phone}>
            <Phone size={13} /> <span>{person.phone}</span>
          </a>
        )}
      </div>

      {secondaryManagers.length > 0 && (
        <div className="org-secondary-manager-list">
          {secondaryManagers.map((manager) => (
            <div key={manager.id}>
              <GitBranch size={13} />
              <span>
                {manager.label}: <b>{manager.name}</b>
              </span>
            </div>
          ))}
        </div>
      )}

      {directCount > 0 && (
        <button className="org-toggle" type="button" onClick={onToggle}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {expanded ? "Collapse team" : "Expand team"}
        </button>
      )}
    </article>
  );
}

function TreeNode({
  person,
  people,
  reportingLines,
  expanded,
  setExpanded,
  query,
  ancestry = new Set<string>(),
}: {
  person: Person;
  people: Person[];
  reportingLines: ReportingLine[];
  expanded: Set<string>;
  setExpanded: (next: Set<string>) => void;
  query: string;
  ancestry?: Set<string>;
}) {
  const nextAncestry = new Set(ancestry);
  nextAncestry.add(person.id);
  const children = people.filter((item) => item.manager_id === person.id && !nextAncestry.has(item.id));
  const open = expanded.has(person.id);
  const secondaryManagers = reportingLines
    .filter((line) => line.employee_id === person.id && line.active)
    .map((line) => {
      const manager = people.find((candidate) => candidate.id === line.manager_id);
      return manager
        ? { id: line.id, name: manager.full_name || "Manager", label: line.label || "Functional manager" }
        : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string; label: string }>;

  const searchText = `${person.full_name || ""} ${person.job_title || ""} ${person.position_title || ""} ${person.department_name || ""}`.toLowerCase();
  const isMatch = Boolean(query && searchText.includes(query.toLowerCase()));

  function toggle() {
    const next = new Set(expanded);
    if (open) next.delete(person.id);
    else next.add(person.id);
    setExpanded(next);
  }

  return (
    <li className="tree-node">
      <EmployeeCard
        person={person}
        directCount={children.length}
        secondaryManagers={secondaryManagers}
        expanded={open}
        onToggle={toggle}
        isMatch={isMatch}
      />
      {children.length > 0 && open && (
        <ul>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              person={child}
              people={people}
              reportingLines={reportingLines}
              expanded={expanded}
              setExpanded={setExpanded}
              query={query}
              ancestry={nextAncestry}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartClient({ people, reportingLines }: { people: Person[]; reportingLines: ReportingLine[] }) {
  const roots = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person]));
    const normalRoots = people.filter((person) => !person.manager_id || !byId.has(person.manager_id));
    const reachable = new Set<string>();
    const walk = (id: string) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      people.filter((person) => person.manager_id === id).forEach((person) => walk(person.id));
    };
    normalRoots.forEach((root) => walk(root.id));
    const disconnected = people.filter((person) => !reachable.has(person.id));
    return [...normalRoots, ...disconnected];
  }, [people]);

  const departments = useMemo(
    () => Array.from(new Set(people.map((person) => person.department_name).filter(Boolean))).sort() as string[],
    [people]
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set(people.map((person) => person.id)));
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [zoom, setZoom] = useState(0.82);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const visiblePeople = useMemo(() => {
    if (!department) return people;
    const selected = new Set(people.filter((person) => person.department_name === department).map((person) => person.id));
    people.forEach((person) => {
      if (!selected.has(person.id)) return;
      let current = person;
      while (current.manager_id) {
        selected.add(current.manager_id);
        const manager = people.find((candidate) => candidate.id === current.manager_id);
        if (!manager) break;
        current = manager;
      }
    });
    return people.filter((person) => selected.has(person.id));
  }, [people, department]);

  const visibleRoots = useMemo(() => {
    const visibleIds = new Set(visiblePeople.map((person) => person.id));
    return roots.filter((root) => visibleIds.has(root.id));
  }, [roots, visiblePeople]);

  useEffect(() => {
    function calculate() {
      const stage = stageRef.current;
      if (!stage) return;
      const bounds = stage.getBoundingClientRect();
      const next: Connector[] = [];
      for (const relation of reportingLines.filter((line) => line.active)) {
        const manager = stage.querySelector<HTMLElement>(`[data-person-id="${relation.manager_id}"]`);
        const employee = stage.querySelector<HTMLElement>(`[data-person-id="${relation.employee_id}"]`);
        if (!manager || !employee) continue;
        const m = manager.getBoundingClientRect();
        const e = employee.getBoundingClientRect();
        next.push({
          id: relation.id,
          x1: (m.left + m.width / 2 - bounds.left) / zoom,
          y1: (m.bottom - bounds.top) / zoom,
          x2: (e.left + e.width / 2 - bounds.left) / zoom,
          y2: (e.top - bounds.top) / zoom,
          label: relation.label || "Secondary reporting",
        });
      }
      setConnectors(next);
    }
    const timer = window.setTimeout(calculate, 120);
    const observer = new ResizeObserver(calculate);
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener("resize", calculate);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", calculate);
    };
  }, [visiblePeople, reportingLines, expanded, zoom]);

  function fitToView() {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (!viewport || !stage) return;
    const unscaledWidth = stage.scrollWidth / zoom;
    const nextZoom = Math.max(0.48, Math.min(1, (viewport.clientWidth - 48) / Math.max(unscaledWidth, 1)));
    setZoom(Number(nextZoom.toFixed(2)));
    window.setTimeout(() => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = 0;
    }, 80);
  }

  return (
    <div className="premium-org-shell">
      <div className="org-toolbar premium-org-toolbar">
        <div className="org-toolbar-left">
          <label className="org-search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, role or department" />
          </label>
          <select value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">All departments</option>
            {departments.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="org-toolbar-right">
          <span className="org-people-count"><Users size={15} /> {people.length} employees</span>
          <button type="button" onClick={() => setExpanded(new Set(people.map((person) => person.id)))}>Expand all</button>
          <button type="button" onClick={() => setExpanded(new Set())}>Collapse all</button>
          <div className="org-zoom-controls">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.45, Number((value - 0.08).toFixed(2))))}><Minus size={15} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.25, Number((value + 0.08).toFixed(2))))}><Plus size={15} /></button>
            <button type="button" onClick={fitToView}><Maximize2 size={15} /> Fit</button>
          </div>
        </div>
      </div>

      <div className="org-legend-bar">
        <span><i className="solid-line-sample" /> Primary reporting</span>
        <span><i className="dotted-line-sample" /> Secondary / functional reporting</span>
      </div>

      <div className="org-chart-viewport" ref={viewportRef}>
        <div className="org-chart-stage" ref={stageRef} style={{ transform: `scale(${zoom})` }}>
          <svg className="org-secondary-lines" aria-hidden="true">
            {connectors.map((line) => {
              const bend = Math.max(45, Math.abs(line.y2 - line.y1) * 0.45);
              return (
                <g key={line.id}>
                  <path d={`M ${line.x1} ${line.y1} C ${line.x1} ${line.y1 + bend}, ${line.x2} ${line.y2 - bend}, ${line.x2} ${line.y2}`} />
                  <circle cx={line.x1} cy={line.y1} r="3" />
                  <circle cx={line.x2} cy={line.y2} r="3" />
                  <title>{line.label}</title>
                </g>
              );
            })}
          </svg>
          <ul className="org-tree premium-org-tree">
            {visibleRoots.map((root) => (
              <TreeNode
                key={root.id}
                person={root}
                people={visiblePeople}
                reportingLines={reportingLines}
                expanded={expanded}
                setExpanded={setExpanded}
                query={query}
                ancestry={new Set<string>()}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
