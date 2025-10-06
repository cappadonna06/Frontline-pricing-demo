import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";

// ---------- Helpers ----------
const fmtUSD = (n: number) =>
  isFinite(n)
    ? n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const approxEq = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// ---------- Constants ----------
const ASE_BASE = {
  MP3: { S: 795, M: 895, L: 995 },
  LV2: { S: 995, M: 1095, L: 1195 },
};

const initialASEAdders = {
  MP3: {
    S: { foam: 99, booster: 149, pool: 129, solar: 79 },
    M: { foam: 119, booster: 169, pool: 149, solar: 89 },
    L: { foam: 139, booster: 189, pool: 169, solar: 99 },
  },
  LV2: {
    S: { foam: 149, booster: 189, pool: 159, solar: 89 },
    M: { foam: 169, booster: 199, pool: 179, solar: 99 },
    L: { foam: 189, booster: 219, pool: 199, solar: 109 },
  },
};

const SUB_BASE = { MP3: 89, LV2: 129 };

const VERTICALS = [
  { key: "res", label: "Luxury Residential", multiplier: 1.0 },
  { key: "prod", label: "Production / Community", multiplier: 0.9 },
  { key: "ci", label: "C&I / Commercial", multiplier: 0.95 },
];

const GM_PRESETS = [
  { key: "res", label: "Residential 50% GM", systemGM: 0.5, adderGM: 0.5 },
  { key: "ci", label: "C&I 42.5% GM", systemGM: 0.425, adderGM: 0.425 },
  { key: "prod", label: "Production 37.5% GM", systemGM: 0.375, adderGM: 0.375 },
];

// ---------- Component ----------
export default function FrontlinePricingCalculator() {
  const [family, setFamily] = useState<"MP3" | "LV2">("MP3");
  const [size, setSize] = useState<"S" | "M" | "L">("M");
  const [systemCost, setSystemCost] = useState<number>(50000);
  const [targetGM, setTargetGM] = useState<number>(0.5);
  const [systemPrice, setSystemPrice] = useState<number>(
    Math.round(50000 / (1 - 0.5))
  );
  const [lastEdited, setLastEdited] = useState<"cost" | "gm" | "price">("price");
  const [verticalKey, setVerticalKey] = useState<string>("res");
  const [isHighUsage, setIsHighUsage] = useState<boolean>(false);
  const [annualBilling, setAnnualBilling] = useState<boolean>(false);
  const [includeFoam, setIncludeFoam] = useState<boolean>(true);
  const [includeBooster, setIncludeBooster] = useState<boolean>(false);
  const [includePool, setIncludePool] = useState<boolean>(false);
  const [includeSolar, setIncludeSolar] = useState<boolean>(false);
  const [includeUPS, setIncludeUPS] = useState<boolean>(false);
  const [foamSize, setFoamSize] = useState<"S" | "M" | "L" | "XL" | null>(null);
  const [boosterSize, setBoosterSize] = useState<"S" | "M" | "L" | null>(null);
  const [poolSize, setPoolSize] = useState<"S" | "M" | "L" | null>(null);
  const [adderGM, setAdderGM] = useState<number>(0.5);
  const [adderCost, setAdderCost] = useState({
    foam: { S: 700, M: 1000, L: 1400, XL: 1800 },
    booster: {
      MP3: { S: 1100, M: 1650, L: 2300 },
      LV2: { S: 1400, M: 2100, L: 2900 },
    },
    pool: {
      MP3: { S: 450, M: 750, L: 1050 },
      LV2: { S: 600, M: 900, L: 1200 },
    },
    solar: { flat: 700 },
    ups: { flat: 250 },
  });

  const [ASE_ADDERS, setASE_ADDERS] = useState(initialASEAdders);
  const [showJSON, setShowJSON] = useState<boolean>(false);

  // ---------- Derived ----------
  const recalc = useMemo(() => {
    let price = systemPrice;
    let cost = systemCost;
    let gm = clamp(targetGM, 0.05, 0.9);

    if (lastEdited === "price") gm = clamp((price - cost) / Math.max(price, 1), 0, 0.95);
    else if (lastEdited === "gm" || lastEdited === "cost")
      price = Math.round(cost / Math.max(1 - gm, 0.01));
    return { price, cost, gm };
  }, [systemPrice, systemCost, targetGM, lastEdited]);

  const systemSizeKey = size;
  const foamActiveSize = (foamSize ?? systemSizeKey) as any;
  const boosterActiveSize = (boosterSize ?? systemSizeKey) as any;
  const poolActiveSize = (poolSize ?? systemSizeKey) as any;
  const priceFromGM = (cost: number, gm: number) =>
    Math.round(cost / Math.max(1 - gm, 0.01));

  const foamCost = includeFoam ? adderCost.foam[foamActiveSize] : 0;
  const boosterCost = includeBooster ? adderCost.booster[family][boosterActiveSize] : 0;
  const poolCost = includePool ? adderCost.pool[family][poolActiveSize] : 0;
  const solarCost = includeSolar ? adderCost.solar.flat : 0;
  const upsCost = includeUPS ? adderCost.ups.flat : 0;

  const foamPrice = includeFoam ? priceFromGM(foamCost, adderGM) : 0;
  const boosterPrice = includeBooster ? priceFromGM(boosterCost, adderGM) : 0;
  const poolPrice = includePool ? priceFromGM(poolCost, adderGM) : 0;
  const solarPrice = includeSolar ? priceFromGM(solarCost, adderGM) : 0;
  const upsPrice = includeUPS ? priceFromGM(upsCost, adderGM) : 0;

  const addersTotal = foamPrice + boosterPrice + poolPrice + solarPrice + upsPrice;

  const aseBase = ASE_BASE[family][systemSizeKey];
  const aseAdderTable = ASE_ADDERS[family][systemSizeKey];
  const aseAddersSum =
    (includeFoam ? aseAdderTable.foam : 0) +
    (includeBooster ? aseAdderTable.booster : 0) +
    (includePool ? aseAdderTable.pool : 0) +
    (includeSolar ? aseAdderTable.solar : 0);
  const aseAnnual = aseBase + aseAddersSum;

  const vertical = VERTICALS.find((v) => v.key === verticalKey)!;
  const subList = SUB_BASE[family];
  let subMonthly = subList * vertical.multiplier + (isHighUsage ? 20 : 0);
  if (annualBilling) subMonthly *= 0.9;
  subMonthly = Math.round(subMonthly * 100) / 100;

  const oneTimeTotal = recalc.price + addersTotal;

  // ---------- UI ----------
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Frontline Pricing Calculator</h1>
        <div className="flex gap-2">
          {GM_PRESETS.map((p) => (
            <Button
              key={p.key}
              variant="secondary"
              size="sm"
              onClick={() => {
                setTargetGM(p.systemGM);
                setAdderGM(p.adderGM);
                setLastEdited("gm");
              }}
            >
              {p.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* System Config */}
      <Card>
        <CardHeader>
          <CardTitle>System type and size</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Family</Label>
            <Select value={family} onValueChange={setFamily}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MP3">MP3</SelectItem>
                <SelectItem value="LV2">LV2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Small (0–3 zones)</SelectItem>
                <SelectItem value="M">Medium (4–6 zones)</SelectItem>
                <SelectItem value="L">Large (7–9 zones)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader><CardTitle>Quote Summary</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 items-start">
          <SummaryRow label="System Price" value={fmtUSD(recalc.price)} />
          <SummaryRow label="Adders Total" value={fmtUSD(addersTotal)} />
          <SummaryRow label="One-Time Total" value={fmtUSD(oneTimeTotal)} bold />
          <SummaryRow label="ASE (Annual)" value={fmtUSD(aseAnnual)} />
          <SummaryRow label="Subscription (Monthly)" value={fmtUSD(subMonthly)} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "font-semibold" : ""
      }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
