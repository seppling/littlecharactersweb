/**
 * What a report's page needs besides its rows: the choices for its filters,
 * and the filters in words (the page's line and the PDF's subtitle).
 */
import { staffSession } from '../classes';
import { classTitle, dayShort, monthName, seasonsOf, weekStart, type ReportFilters } from './common';
import type { Loads, ReportDef } from './library';

export interface Option {
  value: string;
  label: string;
}

/** The choices for each filter the report takes. */
export function filterOptions(def: ReportDef, loads: Loads) {
  const { content, today } = loads.ctx;
  const seasons: Option[] = seasonsOf(content.programs)
    .reverse()
    .map((s) => ({ value: s.term, label: s.term }));
  if (def.allSeasons) seasons.push({ value: 'all', label: 'All seasons' });
  const programs: Option[] = content.programs.filter((p) => p.sessions.some(staffSession)).map((p) => ({ value: p.slug, label: p.title })).sort((a, b) => a.label.localeCompare(b.label));
  const locationIds = new Set(content.programs.flatMap((p) => p.sessions.filter(staffSession).map((s) => s.locationId)));
  const locations: Option[] = [...locationIds].map((id) => ({ value: id, label: content.locationById(id)?.shortName ?? id })).sort((a, b) => a.label.localeCompare(b.label));
  // Classes: current and upcoming first, then ended ones, each by name.
  const classes: Option[] = content.programs
    .flatMap((p) => p.sessions.filter(staffSession).map((s) => ({ s, label: `${classTitle(content, s.id)} · ${s.term}` })))
    .sort((a, b) => Number(a.s.endDate < today) - Number(b.s.endDate < today) || a.label.localeCompare(b.label))
    .map(({ s, label }) => ({ value: s.id, label: s.endDate < today ? `${label} (ended)` : label }));
  const shows: Option[] = content.events.filter((e) => e.kind === 'show').map((e) => ({ value: e.slug, label: e.title }));
  return { seasons, programs, locations, classes, shows };
}

/** The filters in words: "Fall 2026 · Intro to Theater · HQ". Empty when none apply. */
export function filtersLine(def: ReportDef, f: ReportFilters, loads: Loads) {
  const { content, today } = loads.ctx;
  const parts: string[] = [];
  for (const k of def.filters) {
    if (k === 'season') parts.push(f.season === 'all' && def.allSeasons ? 'All seasons' : (f.season ?? loads.seasons().current ?? 'No season yet'));
    if (k === 'month' && (f.month || def.key === 'payments-received')) parts.push(monthName(f.month ?? today.slice(0, 7)));
    if (k === 'program' && f.program) parts.push(content.programBySlug(f.program)?.title ?? f.program);
    if (k === 'location' && f.location) parts.push(content.locationById(f.location)?.shortName ?? f.location);
    if (k === 'class' && f.class) parts.push(classTitle(content, f.class));
    if (k === 'show' && f.show) parts.push(content.events.find((e) => e.slug === f.show)?.title ?? f.show);
    if (k === 'week') parts.push(`Week of ${dayShort(weekStart(f.week ?? today))}`);
    if (k === 'who') parts.push(f.who === 'all' ? 'Every family with a class' : 'New families');
  }
  return parts.join(' · ');
}
