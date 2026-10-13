"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "./ui";

export const SERIES_COLORS = ["#0a8c76", "#6ce0c4", "#0e4a42", "#f59e0b", "#6366f1", "#ef4444"];

const fmtMoney = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export function BarChartCard({
  title,
  description,
  data,
  keys,
  currency,
  stacked,
  height = 260,
}: {
  title: string;
  description?: string;
  data: Record<string, string | number>[];
  keys: string[];
  currency?: boolean;
  stacked?: boolean;
  height?: number;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-2 py-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke="#e3e8e7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5d6b69" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#5d6b69" }} axisLine={false} tickLine={false} width={currency ? 64 : 32} tickFormatter={currency ? fmtMoney : undefined} allowDecimals={false} />
            <Tooltip formatter={(v: number) => (currency ? fmtMoney(v) : v)} contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 13 }} cursor={{ fill: "#f6f8f8" }} />
            {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[4, 4, 0, 0]} stackId={stacked ? "s" : undefined} maxBarSize={36} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function LineChartCard({ title, description, data, keys, height = 260 }: { title: string; description?: string; data: Record<string, string | number | null>[]; keys: string[]; height?: number }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-2 py-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke="#e3e8e7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5d6b69" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#5d6b69" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 13 }} />
            {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function DonutCard({ title, description, data, height = 260 }: { title: string; description?: string; data: { label: string; value: number }[]; height?: number }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {total === 0 ? (
        <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
          No data yet
        </div>
      ) : (
        <div className="flex items-center gap-4 px-5 py-4" style={{ height }}>
          <div className="h-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.map((d, i) => (
              <li key={d.label} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                <span className="flex-1">{d.label}</span>
                <span className="tabular-nums text-muted">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
