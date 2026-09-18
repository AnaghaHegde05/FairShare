import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { MemberContribution } from "../types";

interface FairnessChartProps {
  contributions: MemberContribution[];
}

// Actual vs. fair-share bar chart for the dashboard. Reads straight off the
// backend's `contributions` array (fairness.service.ts) — no math happens
// here, it's a pure visualization of numbers the API already computed.
export default function FairnessChart({ contributions }: FairnessChartProps) {
  const data = contributions.map((c) => ({
    name: c.name,
    Actual: c.actual,
    "Fair share": c.expected,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#D8D2C2" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#5C6B72", fontSize: 12 }}
            axisLine={{ stroke: "#D8D2C2" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#5C6B72", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#FBF9F4",
              border: "1px solid #D8D2C2",
              borderRadius: 8,
              fontSize: 13,
            }}
            cursor={{ fill: "rgba(47, 111, 94, 0.06)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#5C6B72" }} />
          <Bar dataKey="Actual" fill="#2F6F5E" radius={[4, 4, 0, 0]} maxBarSize={48} />
          <Bar dataKey="Fair share" fill="#B9860A" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
