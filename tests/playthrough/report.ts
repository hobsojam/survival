import { MILESTONES } from './milestones';
import type { RunResult } from './player';

// Turns a batch of played games into the tables of the playthrough report.

const YEAR_DAYS = 40;

const middle = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const year = (day: number): string => (day / YEAR_DAYS).toFixed(1);
const hours = (minutes: number): string => (minutes / 60).toFixed(1);

function table(heading: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const line = (cells: readonly (string | number)[]): string => `| ${cells.join(' | ')} |`;
  return [line(heading), line(heading.map(() => '---')), ...rows.map(line)].join('\n');
}

const finishes = (run: RunResult): number | null => run.hits.find(hit => hit.id === 'keep-finished')?.day ?? null;

function outcomes(groups: ReadonlyMap<string, readonly RunResult[]>): string {
  return table(['Style', 'Games', 'Reached the keep', 'Keep finished (day: earliest, middle, latest)', 'Years', 'Play hours (middle)', 'Sick days', 'Days at hunger 20 or under'],
    [...groups].map(([style, runs]) => {
      const days = runs.map(finishes).filter((day): day is number => day !== null);
      const minutes = runs.flatMap(run => run.hits.filter(hit => hit.id === 'keep-finished').map(hit => hit.playMinutes));
      return [style, runs.length, days.length, days.length ? `${Math.min(...days)}, ${middle(days)}, ${Math.max(...days)}` : '-', days.length ? year(middle(days)) : '-',
        minutes.length ? hours(middle(minutes)) : '-', runs.reduce((sum, run) => sum + run.sickDays, 0), runs.reduce((sum, run) => sum + run.foodShortDays, 0)];
    }));
}

function timeline(groups: ReadonlyMap<string, readonly RunResult[]>): string {
  const styles = [...groups.keys()];
  const dayOf = (run: RunResult, id: string): number | undefined => run.hits.find(hit => hit.id === id)?.day;
  const rows = MILESTONES.map(milestone => [milestone.label, ...styles.map(style => {
    const days = groups.get(style)!.map(run => dayOf(run, milestone.id)).filter((day): day is number => day !== undefined);
    return days.length ? `${middle(days)} (${Math.min(...days)}–${Math.max(...days)})` : 'never';
  })]);
  return table(['Milestone', ...styles.map(style => `${style}: middle day (range)`)], rows);
}

function gaps(groups: ReadonlyMap<string, readonly RunResult[]>): string {
  const rows = [...groups].map(([style, runs]) => {
    const lengths = runs.map(run => {
      const kept = run.hits.filter(hit => hit.day <= (finishes(run) ?? Infinity)).sort((a, b) => a.day - b.day);
      let longest = { days: 0, after: '', before: '' };
      for (let i = 1; i < kept.length; i++) {
        const days = kept[i].day - kept[i - 1].day;
        if (days > longest.days) longest = { days, after: kept[i - 1].label, before: kept[i].label };
      }
      return longest;
    }).sort((a, b) => a.days - b.days);
    const typical = lengths[Math.floor(lengths.length / 2)];
    const worst = lengths[lengths.length - 1];
    return [style, `${typical.days} days: ${typical.after} → ${typical.before}`, `${worst.days} days: ${worst.after} → ${worst.before}`];
  });
  return table(['Style', 'Longest gap, middle game', 'Longest gap, worst game'], rows);
}

function friction(groups: ReadonlyMap<string, readonly RunResult[]>): string {
  return table(['Style', 'Days with nothing offered (total)', 'Days when all offers had to wait (middle)', 'Bag too full (middle)', 'Cost too big for bag and stores (total)', 'Offers refused when paid for', 'Left undone at the end'],
    [...groups].map(([style, runs]) => {
      const left = new Set(runs.flatMap(run => run.neverDone));
      const refused = runs.reduce((sum, run) => sum + Object.values(run.offeredButRefused).reduce((a, b) => a + b, 0), 0);
      return [style, runs.reduce((sum, run) => sum + run.nothingOfferedDays, 0), middle(runs.map(run => run.allWaitingDays)), middle(runs.map(run => run.fullBagRefusals)),
        runs.reduce((sum, run) => sum + run.tooBigForBag, 0), refused, [...left].join(', ') || 'nothing'];
    }));
}

function guidance(groups: ReadonlyMap<string, readonly RunResult[]>): string {
  const rows = [...groups].map(([style, runs]) => {
    const stale = runs.map(run => {
      const end = finishes(run) ?? run.days;
      return run.journalHints.filter(hint => hint.hint.startsWith('You have followed every path') && hint.fromDay <= end).reduce((sum, hint) => sum + Math.min(hint.toDay, end) - hint.fromDay + 1, 0);
    });
    const before = runs.filter(run => {
      const hills = run.hits.find(hit => hit.id === 'hills')?.day ?? Infinity;
      return run.journalHints.some(hint => hint.hint.startsWith('You have followed every path') && hint.fromDay < hills);
    }).length;
    return [style, middle(stale), before, middle(runs.map(run => run.noneLeftDays)), [...new Set(runs.flatMap(run => run.unbuiltWhenNoneLeft))].join(', ') || 'none'];
  });
  return table(['Style', '"You have followed every path" showing before the keep is done (middle days)', 'Games where it showed before reaching the hills', '"No structures left to build" while some were unbuilt (middle days)', 'Still unbuilt during that line'], rows);
}

export function reportTables(runs: readonly RunResult[]): string {
  const groups = new Map<string, RunResult[]>();
  for (const run of runs) groups.set(run.style, [...(groups.get(run.style) ?? []), run]);
  return [
    '### Outcomes', outcomes(groups),
    '### When each milestone was reached', timeline(groups),
    '### Longest stretch with no new milestone', gaps(groups),
    '### Friction', friction(groups),
    '### What the game was saying', guidance(groups)
  ].join('\n\n');
}
