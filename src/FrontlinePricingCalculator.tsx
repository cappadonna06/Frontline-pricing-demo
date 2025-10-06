import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";

/* -----------------------------
   Utility helpers
------------------------------ */
const fmtUSD = (n: number) =>
  isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—";
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/* -----------------------------
   Canonical reference data
------------------------------ */
const ASE_BASE: Record<string, Record<"S" | "M" | "L", number>> = {
  MP3: { S: 795, M: 895, L: 995 },
  LV2: { S: 995, M: 1095, L: 1195 },
};

const initialASEAdders: Record<
  "MP3" | "LV2",
  Record<"S" | "M" | "L", { foam: number; booster: number; pool: number; solar: number }>
> = {
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

// Subscription base
const SUB_BASE: Record<"MP3" | "LV2", number> = { MP3: 89, LV2: 129 };

const VERTICALS: { key: string; label: string; multiplier: number }[] = [
  { key: "res", label: "Luxury Residential", multiplier: 1.0 },
  { key: "prod", label: "Production / Community", multiplier: 0.9 },
  { key: "ci", label: "C&I / Commercial", multiplier: 0.95 },
];

const GM_PRESETS = [
  { key: "res", label: "Residential 50% GM", systemGM: 0.5, adderGM: 0.5 },
  { key: "ci", label: "C&I 42.5% GM", systemGM: 0.425, adderGM: 0.425 },
  { key: "prod", label: "Production 37.5% GM", systemGM: 0.375, adderGM: 0.375 },
];

const ADDER_NOTES = {
  foam: "Foam auto-sizes to system S/M/L; XL available as manual override.",
  booster: "Booster auto-sizes to meet required pressure/flow.",
  pool: "Pool/Draft kit scales by hose diameter & flow.",
  solar: "Universal (no size)",
  ups: "Universal (no size)",
};

/* =============================
   MAIN COMPONENT
============================= */
export default function FrontlinePricingCalculator() {
  // System definition
  const [family, setFamily] = useState<"MP3" | "LV2">("MP3");
  const [size, setSize] = useState<"S" | "M" | "L">("M");

  // Cost/GM/Price with two-way coupling
  const [systemCost, setSystemCost] = useState<number>(50000);
  const [targetGM, setTargetGM] = useState<number>(0.5); // 50%
  const [systemPrice, setSystemPrice] = useState<number>(() => Math.round(50000 / (1 - 0.5)));
  const [lastEdited, setLastEdited] = useState<"cost" | "gm" | "price">("price");

  // Subscription
  const [verticalKey, setVerticalKey] = useState<string>("res");
  const [isHighUsage, setIsHighUsage] = useState<boolean>(false);
  const [annualBilling, setAnnualBilling] = useState<boolean>(false); // –10% if true

  // Adders enabled
  const [includeFoam, setIncludeFoam] = useState<boolean>(true);
  const [includeBooster, setIncludeBooster] = useState<boolean>(false);
  const [includePool, setIncludePool] = useState<boolean>(false);
  const [includeSolar, setIncludeSolar] = useState<boolean>(false);
  const [includeUPS, setIncludeUPS] = useState<boolean>(false);

  // Per-adder size override
  const [foamSize, setFoamSize] = useState<"S" | "M" | "L" | "XL" | null>(null);
  const [boosterSize, setBoosterSize] = useState<"S" | "M" | "L" | null>(null);
  const [poolSize, setPoolSize] = useState<"S" | "M" | "L" | null>(null);

  // Adder GM
  const [adderGM, setAdderGM] = useState<number>(0.5); // 50%

  // Adder COSTs by size (editable)
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

  // ASE adder increments — STATE (editable via grid)
  const [ASE_ADDERS, setASE_ADDERS] = useState(initialASEAdders);

  // Collapsible JSON
  const [showJSON, setShowJSON] = useState<boolean>(false);

  /* -----------------------------
     Derived: two-way coupling logic
  ------------------------------ */
  const recalc = useMemo(() => {
    let price = systemPrice;
    let cost = systemCost;
    let gm = clamp(targetGM, 0.05, 0.9);

    if (lastEdited === "price") {
      gm = clamp((price - cost) / Math.max(price, 1), 0, 0.95);
    } else if (lastEdited === "gm") {
      price = Math.round(cost / Math.max(1 - gm, 0.01));
    } else if (lastEdited === "cost") {
      price = Math.round(cost / Math.max(1 - gm, 0.01));
    }
    return { price, cost, gm };
  }, [systemPrice, systemCost, targetGM, lastEdited]);

  /* -----------------------------
     Adder sizing & pricing
  ------------------------------ */
  const systemSizeKey = size as "S" | "M" | "L";
  const foamActiveSize: "S" | "M" | "L" | "XL" = (foamSize ?? systemSizeKey) as any;
  const boosterActiveSize: "S" | "M" | "L" = (boosterSize ?? systemSizeKey) as any;
  const poolActiveSize: "S" | "M" | "L" = (poolSize ?? systemSizeKey) as any;

  const priceFromGM = (cost: number, gm: number) => Math.round(cost / Math.max(1 - gm, 0.01));

  const foamCost = includeFoam ? (adderCost.foam as any)[foamActiveSize] : 0;
  const boosterCost = includeBooster ? adderCost.booster[family][boosterActiveSize] : 0;
  const poolCost = includePool ? adderCost.pool[family][poolActiveSize] : 0;
  const solarCost = includeSolar ? adderCost.solar.flat : 0; // not size-dependent
  const upsCost = includeUPS ? adderCost.ups.flat : 0; // not size-dependent

  const foamPrice = includeFoam ? priceFromGM(foamCost, adderGM) : 0;
  const boosterPrice = includeBooster ? priceFromGM(boosterCost, adderGM) : 0;
  const poolPrice = includePool ? priceFromGM(poolCost, adderGM) : 0;
  const solarPrice = includeSolar ? priceFromGM(solarCost, adderGM) : 0;
  const upsPrice = includeUPS ? priceFromGM(upsCost, adderGM) : 0;

  const addersTotal = foamPrice + boosterPrice + poolPrice + solarPrice + upsPrice;

  /* -----------------------------
     ASE (annual)
  ------------------------------ */
  const aseBase = ASE_BASE[family][systemSizeKey];
  const aseAdderTable = ASE_ADDERS[family][systemSizeKey];
  const aseAddersSum =
    (includeFoam ? aseAdderTable.foam : 0) +
    (includeBooster ? aseAdderTable.booster : 0) +
    (includePool ? aseAdderTable.pool : 0) +
    (includeSolar ? aseAdderTable.solar : 0);
  const aseAnnual = aseBase + aseAddersSum;

  /* -----------------------------
     Subscription (monthly)
  ------------------------------ */
  const vertical = VERTICALS.find((v) => v.key === verticalKey)!;
  const subList = SUB_BASE[family];
  let subMonthly = subList * vertical.multiplier + (isHighUsage ? 20 : 0);
  if (annualBilling) subMonthly = subMonthly * 0.9; // –10% annual prepay
  subMonthly = Math.round(subMonthly * 100) / 100;

  /* -----------------------------
     Totals
  ------------------------------ */
  const oneTimeTotal = recalc.price + addersTotal;

  /* -----------------------------
     Actions
  ------------------------------ */
  const applyGMPreset = (sysGM: number, addGM: number) => {
    setTargetGM(sysGM);
    setAdderGM(addGM);
    setLastEdited("gm");
  };

  const resetAll = () => {
    setFamily("MP3");
    setSize("M");
    setSystemCost(50000);
    setTargetGM(0.5);
    setSystemPrice(Math.round(50000 / (1 - 0.5)));
    setLastEdited("price");
    setVerticalKey("res");
    setIsHighUsage(false);
    setAnnualBilling(false);
    setIncludeFoam(true);
    setIncludeBooster(false);
    setIncludePool(false);
    setIncludeSolar(false);
    setIncludeUPS(false);
    setFoamSize(null);
    setBoosterSize(null);
    setPoolSize(null);
    setAdderGM(0.5);
    setAdderCost({
      foam: { S: 700, M: 1000, L: 1400, XL: 1800 },
      booster: { MP3: { S: 1100, M: 1650, L: 2300 }, LV2: { S: 1400, M: 2100, L: 2900 } },
      pool: { MP3: { S: 450, M: 750, L: 1050 }, LV2: { S: 600, M: 900, L: 1200 } },
      solar: { flat: 700 },
      ups: { flat: 250 },
    });
    setASE_ADDERS(initialASEAdders);
    setShowJSON(false);
  };

  // Reset some defaults when family changes
  React.useEffect(() => {
    setIncludeFoam(true);
    setIncludeBooster(false);
    setIncludePool(false);
    setIncludeSolar(false);
    setIncludeUPS(false);
    setFoamSize(null);
    setBoosterSize(null);
    setPoolSize(null);
    const defaultCost = family === "MP3" ? 50000 : 60000;
    setSystemCost(defaultCost);
    setLastEdited("cost");
  }, [family]);

  /* =============================
     RENDER
  ============================= */
  return (
    <div className="p-0 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Frontline Pricing Calculator — MP3/LV2</h1>
        <div className="flex gap-2">
          <div className="hidden md:flex gap-2">
            {GM_PRESETS.map((p) => (
              <Button key={p.key} variant="secondary" size="sm" onClick={() => applyGMPreset(p.systemGM, p.adderGM)}>
                {p.label}
              </Button>
            ))}
          </div>
          <Button variant="secondary" onClick={resetAll}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* System Config */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>System type and size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Family</Label>
              <Select value={family} onValueChange={(v: any) => setFamily(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MP3">MP3</SelectItem>
                  <SelectItem value="LV2">LV2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Select value={size} onValueChange={(v: any) => setSize(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">Small (0–3 zones)</SelectItem>
                  <SelectItem value="M">Medium (4–6 zones)</SelectItem>
                  <SelectItem value="L">Large (7–9 zones)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-2">
                LV2 is generally recommended for &gt;9 zones or higher-flow estates.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cost / GM / Price */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Base System Price — Two-Way Cost ↔ GM ↔ Price</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>System Cost (COGS)</Label>
                <Input
                  type="number"
                  value={recalc.cost}
                  onChange={(e) => {
                    setSystemCost(Number(e.target.value || 0));
                    setLastEdited("cost");
                  }}
                />
              </div>
              <div>
                <Label>Target GM</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-28"
                    type="number"
                    step="0.01"
                    min="0"
                    max="0.95"
                    value={recalc.gm.toFixed(2)}
                    onChange={(e) => {
                      setTargetGM(Number(e.target.value || 0));
                      setLastEdited("gm");
                    }}
                  />
                  <span className="text-sm text-slate-500">({(recalc.gm * 100).toFixed(0)}%)</span>
                </div>
              </div>
              <div>
                <Label>Base System Price (Installed)</Label>
                <Input
                  type="number"
                  value={recalc.price}
                  onChange={(e) => {
                    setSystemPrice(Number(e.target.value || 0));
                    setLastEdited("price");
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Rounded to nearest $100 is recommended when quoting.</p>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500">System Target GM</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-full max-w-xs">
                  <Slider
                    value={[recalc.gm]}
                    min={0.2}
                    max={0.7}
                    step={0.01}
                    onValueChange={([v]) => {
                      setTargetGM(Number(v.toFixed(2)));
                      setLastEdited("gm");
                    }}
                  />
                </div>
                <div className="w-12 text-right tabular-nums">{Math.round(recalc.gm * 100)}%</div>
              </div>
            </div>

            <div className="flex md:hidden gap-2">
              {GM_PRESETS.map((p) => (
                <Button key={p.key} variant="secondary" size="sm" onClick={() => applyGMPreset(p.systemGM, p.adderGM)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adders */}
      <Card>
        <CardHeader>
          <CardTitle>System adders</CardTitle>
          <p className="text-xs text-slate-500">Size follows system by default; override below.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-4">
            {/* Foam */}
            <AdderBlock
              title="Foam System"
              note={ADDER_NOTES.foam}
              typeLabel="Universal"
              enabled={includeFoam}
              onToggle={setIncludeFoam}
              recommendedSize={systemSizeKey}
              activeSize={foamActiveSize}
              onSelectSize={setFoamSize}
              sizes={["S", "M", "L", "XL"]}
              costBySize={adderCost.foam}
              setCostBySize={(v: any) => setAdderCost((s) => ({ ...s, foam: v }))}
              calcPrice={(k: any) => priceFromGM((adderCost.foam as any)[k], adderGM)}
            />

            {/* Booster */}
            <AdderBlock
              title="Booster Pump"
              note={ADDER_NOTES.booster}
              typeLabel={family}
              enabled={includeBooster}
              onToggle={setIncludeBooster}
              recommendedSize={systemSizeKey}
              activeSize={boosterActiveSize}
              onSelectSize={setBoosterSize}
              sizes={["S", "M", "L"]}
              costBySize={adderCost.booster[family]}
              setCostBySize={(v: any) => setAdderCost((s: any) => ({ ...s, booster: { ...s.booster, [family]: v } }))}
              calcPrice={(k: any) => priceFromGM(adderCost.booster[family][k], adderGM)}
            />

            {/* Pool/Draft */}
            <AdderBlock
              title="Pool / Draft Kit"
              note={ADDER_NOTES.pool}
              typeLabel={family}
              enabled={includePool}
              onToggle={setIncludePool}
              recommendedSize={systemSizeKey}
              activeSize={poolActiveSize}
              onSelectSize={setPoolSize}
              sizes={["S", "M", "L"]}
              costBySize={adderCost.pool[family]}
              setCostBySize={(v: any) => setAdderCost((s: any) => ({ ...s, pool: { ...s.pool, [family]: v } }))}
              calcPrice={(k: any) => priceFromGM(adderCost.pool[family][k], adderGM)}
            />

            {/* Solar */}
            <Card className={`p-4 ${includeSolar ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Type: <span className="font-semibold">Universal</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">Solar Backup</div>
                  <div className="text-xs text-slate-500">{ADDER_NOTES.solar}</div>
                </div>
                <Switch
                  checked={includeSolar}
                  onCheckedChange={setIncludeSolar}
                  className={includeSolar ? "ring-2 ring-emerald-300 rounded-full" : ""}
                />
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-500">
                  <div>Cost</div>
                  <div className="text-right">Price</div>
                </div>
                <div className={`grid grid-cols-2 gap-2 items-center p-2 rounded-md ${includeSolar ? "bg-emerald-50 ring-1 ring-emerald-300" : ""}`}>
                  <Input
                    aria-label="Solar Cost"
                    type="number"
                    value={adderCost.solar.flat}
                    onChange={(e) => setAdderCost((s) => ({ ...s, solar: { flat: Number(e.target.value || 0) } }))}
                  />
                  <div className="text-right text-sm font-medium">{fmtUSD(priceFromGM(adderCost.solar.flat, adderGM))}</div>
                </div>
              </div>
            </Card>

            {/* UPS */}
            <Card className={`p-4 ${includeUPS ? "border-emerald-300 bg-emerald-50/40" : ""}`}>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Type: <span className="font-semibold">Universal</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">UPS (8-Day)</div>
                  <div className="text-xs text-slate-500">{ADDER_NOTES.ups}</div>
                </div>
                <Switch
                  checked={includeUPS}
                  onCheckedChange={setIncludeUPS}
                  className={includeUPS ? "ring-2 ring-emerald-300 rounded-full" : ""}
                />
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-500">
                  <div>Cost</div>
                  <div className="text-right">Price</div>
                </div>
                <div className={`grid grid-cols-2 gap-2 items-center p-2 rounded-md ${includeUPS ? "bg-emerald-50 ring-1 ring-emerald-300" : ""}`}>
                  <Input
                    aria-label="UPS Cost"
                    type="number"
                    value={adderCost.ups.flat}
                    onChange={(e) => setAdderCost((s) => ({ ...s, ups: { flat: Number(e.target.value || 0) } }))}
                  />
                  <div className="text-right text-sm font-medium">{fmtUSD(priceFromGM(adderCost.ups.flat, adderGM))}</div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-start">
            <div>
              <Label>Adder Target GM</Label>
              <div className="flex items-center gap-3 mt-1">
                <Slider value={[adderGM]} min={0.3} max={0.7} step={0.01} onValueChange={([v]) => setAdderGM(Number(v.toFixed(2)))} />
                <div className="w-12 text-right tabular-nums">{Math.round(adderGM * 100)}%</div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Applies to all adder costs (Foam/Booster/Pool/Solar/UPS).</p>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <SummaryRow label="Foam System" value={includeFoam ? fmtUSD(foamPrice) : "—"} />
              <SummaryRow label="Booster Pump" value={includeBooster ? fmtUSD(boosterPrice) : "—"} />
              <SummaryRow label="Pool/Draft Kit" value={includePool ? fmtUSD(poolPrice) : "—"} />
              <SummaryRow label="Solar Backup" value={includeSolar ? fmtUSD(solarPrice) : "—"} />
              <SummaryRow label="UPS (8-Day)" value={includeUPS ? fmtUSD(upsPrice) : "—"} />
              <SummaryRow label="Adders Subtotal" value={fmtUSD(addersTotal)} bold />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ASE & Subscription */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>ASE (Annual Service & Extension)</CardTitle>
            <p className="text-xs text-slate-500">Service adders are editable below and sync live with these totals.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SummaryRow label={`Base (${family}-${size})`} value={fmtUSD(aseBase)} />
              {includeFoam && <SummaryRow label="Foam adder" value={fmtUSD(ASE_ADDERS[family][systemSizeKey].foam)} />}
              {includeBooster && <SummaryRow label="Booster adder" value={fmtUSD(ASE_ADDERS[family][systemSizeKey].booster)} />}
              {includePool && <SummaryRow label="Pool/Draft adder" value={fmtUSD(ASE_ADDERS[family][systemSizeKey].pool)} />}
              {includeSolar && <SummaryRow label="Solar adder" value={fmtUSD(ASE_ADDERS[family][systemSizeKey].solar)} />}
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>Total (Annual)</span>
              <span>{fmtUSD(aseAnnual)}</span>
            </div>
            <p className="text-xs text-slate-500">ASE adders mirror selected hardware adders (Foam/Booster/Pool/Solar). UPS does not affect ASE.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription (Connectivity / App / OTA)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vertical</Label>
                <Select value={verticalKey} onValueChange={(v) => setVerticalKey(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">Multiplies list price by vertical factor.</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label>High-Usage Add-On (+$20)</Label>
                  <p className="text-xs text-slate-500">For cell-primary or satellite systems</p>
                </div>
                <Switch checked={isHighUsage} onCheckedChange={setIsHighUsage} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={annualBilling} onCheckedChange={setAnnualBilling} />
                <span className="text-sm">Annual billing (–10%)</span>
              </div>
              <div className="text-sm">
                Base: {family} @ {fmtUSD(SUB_BASE[family])}/mo
              </div>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>Total Subscription (Monthly)</span>
              <span>{fmtUSD(subMonthly)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 items-start">
          <div className="space-y-1">
            <SummaryRow label="System Price (Installed)" value={fmtUSD(recalc.price)} />
            <SummaryRow label="Adders Total" value={fmtUSD(addersTotal)} />
            <div className="flex justify-between border-t pt-2 font-semibold text-lg">
              <span>One-Time Total</span>
              <span>{fmtUSD(oneTimeTotal)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <SummaryRow label="ASE (Annual)" value={fmtUSD(aseAnnual)} />
            <SummaryRow label="Subscription (Monthly)" value={fmtUSD(subMonthly)} />
          </div>
          <div className="text-xs text-slate-500">
            <p>Notes:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Foam and Pool/Draft follow system size by default; override controls per-adder.</li>
              <li>GM = (Price − Cost) / Price. You can edit any field; others recompute.</li>
              <li>All pricing in USD; taxes/permits/trenching/travel not included.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Default Adder Costs Grid */}
      <DefaultAdderCostsGrid adderCost={adderCost} setAdderCost={setAdderCost} />

      {/* Service Adders (ASE) Table */}
      <AseEditableTable ASE_ADDERS={ASE_ADDERS} setASE_ADDERS={setASE_ADDERS} />

      {/* Collapsible JSON Export */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowJSON((s) => !s)} className="flex items-center gap-2">
          {showJSON ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide JSON
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show JSON
            </>
          )}
        </Button>
      </div>
      {showJSON && (
        <Card>
          <CardHeader>
            <CardTitle>Export (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-slate-100 p-3 rounded-md overflow-auto max-h-64">
{JSON.stringify(
  {
    system: { family, size, cost: recalc.cost, gm: Number(recalc.gm.toFixed(3)), price: recalc.price },
    adders: {
      foam: includeFoam ? { size: foamActiveSize, cost: foamCost, price: foamPrice } : null,
      booster: includeBooster ? { size: boosterActiveSize, cost: boosterCost, price: boosterPrice } : null,
      pool: includePool ? { size: poolActiveSize, cost: poolCost, price: poolPrice } : null,
      solar: includeSolar ? { cost: solarCost, price: solarPrice } : null,
      ups: includeUPS ? { cost: upsCost, price: upsPrice } : null,
      subtotal: addersTotal,
    },
    ase: { annual: aseAnnual },
    subscription: { monthly: subMonthly, vertical: vertical.label, annualBilling },
    totals: { oneTime: oneTimeTotal },
  },
  null,
  2
)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* =============================
   Helpers / Partials
============================= */

function SummaryRow({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm text-slate-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Adder card with green highlight when enabled + active row highlight */
function AdderBlock({
  title,
  note,
  typeLabel,
  enabled,
  onToggle,
  recommendedSize,
  activeSize,
  onSelectSize,
  sizes,
  costBySize,
  setCostBySize,
  calcPrice,
}: {
  title: string;
  note: string;
  typeLabel: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  recommendedSize: "S" | "M" | "L";
  activeSize: "S" | "M" | "L" | "XL";
  onSelectSize: (v: any) => void; // null means follow recommendation
  sizes: ("S" | "M" | "L" | "XL")[];
  costBySize: any;
  setCostBySize: (v: any) => void;
  calcPrice: (k: any) => number;
}) {
  const wrapperHi = enabled ? "border-emerald-300 bg-emerald-50/40" : "";
  const chip = (s: any) =>
    `border rounded-md px-2 py-1 text-center text-xs cursor-pointer ${
      String(activeSize) === String(s)
        ? enabled
          ? "bg-emerald-100 border-emerald-400"
          : "bg-slate-100 border-slate-300"
        : "hover:bg-slate-50"
    }`;

  const Row = ({ k }: { k: any }) => (
    <div
      className={`grid grid-cols-[80px,1fr,140px] items-center gap-2 p-2 rounded-md ${
        String(activeSize) === String(k)
          ? enabled
            ? "bg-emerald-50 ring-1 ring-emerald-300"
            : "bg-slate-100 ring-1 ring-slate-200"
          : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{k}</div>
      <Input
        className="h-8 text-right"
        type="number"
        value={costBySize[k] ?? ""}
        onChange={(e) => setCostBySize({ ...costBySize, [k]: Number(e.target.value || 0) })}
      />
      <div className="text-right text-sm font-medium tabular-nums">{fmtUSD(calcPrice(k))}</div>
    </div>
  );

  return (
    <Card className={`p-4 space-y-2 ${wrapperHi}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        Type: <span className="font-semibold">{typeLabel}</span>{" "}
        {activeSize !== recommendedSize ? (
          <span className="ml-2 text-amber-600">(Overridden)</span>
        ) : (
          <span className="ml-2 text-slate-400">(Following system)</span>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-slate-500">{note}</div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} className={enabled ? "ring-2 ring-emerald-300 rounded-full" : ""} />
      </div>

      <div>
        <div className="text-[11px] text-slate-500">
          Selected size <span className="font-medium">{activeSize}</span> · <span>Recommended: {recommendedSize}</span>
        </div>

        <div className="mt-1 grid grid-cols-4 gap-2">
          {sizes.map((s) => (
            <label key={s} className={chip(s)} onClick={() => onSelectSize(s)}>
              {s}
            </label>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 mt-1">Clear override to follow recommendation.</div>
        <div className="mt-1">
          <Button variant="ghost" size="sm" onClick={() => onSelectSize(null as any)}>
            Use recommended
          </Button>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div className="grid grid-cols-[80px,1fr,140px] gap-2 text-xs font-medium text-slate-500">
          <div>Size</div>
          <div>Cost</div>
          <div className="text-right">Price</div>
        </div>
        {sizes.map((k) => (
          <Row key={k} k={k} />
        ))}
      </div>
    </Card>
  );
}

/** ASE editable grid */
function AseEditableTable({
  ASE_ADDERS,
  setASE_ADDERS,
}: {
  ASE_ADDERS: any;
  setASE_ADDERS: (fn: any) => void;
}) {
  const HEAD = ["Adder", "MP3 S", "MP3 M", "MP3 L", "LV2 S", "LV2 M", "LV2 L"];
  const KEYS = ["foam", "booster", "pool", "solar"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Adder Prices (ASE) — editable defaults</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              {HEAD.map((h) => (
                <th key={h} className="py-2 pr-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KEYS.map((key) => (
              <tr key={key} className="align-top">
                <td className="py-2 font-medium capitalize pr-4">{key}</td>
                {(["MP3", "LV2"] as const).flatMap((fam) =>
                  (["S", "M", "L"] as const).map((sz) => (
                    <td key={`${key}-${fam}-${sz}`} className="py-2 pr-4 min-w-[160px]">
                      <Input
                        type="number"
                        value={ASE_ADDERS[fam][sz][key]}
                        onChange={(e) =>
                          setASE_ADDERS((prev: any) => ({
                            ...prev,
                            [fam]: {
                              ...prev[fam],
                              [sz]: { ...prev[fam][sz], [key]: Number(e.target.value || 0) },
                            },
                          }))
                        }
                      />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-3">Updates sync with the ASE calculation above.</p>
      </CardContent>
    </Card>
  );
}

/** Default adder costs as S/M/L/XL grids */
function DefaultAdderCostsGrid({
  adderCost,
  setAdderCost,
}: {
  adderCost: any;
  setAdderCost: (fn: any) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Adder Costs (edit to update all pricing)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        <div className="space-y-8">
          {/* Foam */}
          <div>
            <div className="text-sm font-semibold mb-2">Foam</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  {["S", "M", "L", "XL"].map((h) => (
                    <th key={h} className="py-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(["S", "M", "L", "XL"] as const).map((k) => (
                    <td key={k} className="py-2 pr-4 min-w-[140px]">
                      <Input
                        type="number"
                        value={adderCost.foam[k]}
                        onChange={(e) =>
                          setAdderCost((s: any) => ({
                            ...s,
                            foam: { ...s.foam, [k]: Number(e.target.value || 0) },
                          }))
                        }
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Booster */}
          <div>
            <div className="text-sm font-semibold mb-2">Booster</div>
            {(["MP3", "LV2"] as const).map((fam) => (
              <div key={fam} className="mb-4">
                <div className="text-xs uppercase text-slate-500 mb-1">{fam}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      {["S", "M", "L"].map((h) => (
                        <th key={h} className="py-2 pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(["S", "M", "L"] as const).map((k) => (
                        <td key={`${fam}-${k}`} className="py-2 pr-4 min-w-[140px]">
                          <Input
                            type="number"
                            value={adderCost.booster[fam][k]}
                            onChange={(e) =>
                              setAdderCost((s: any) => ({
                                ...s,
                                booster: { ...s.booster, [fam]: { ...s.booster[fam], [k]: Number(e.target.value || 0) } },
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Pool / Draft */}
          <div>
            <div className="text-sm font-semibold mb-2">Pool / Draft</div>
            {(["MP3", "LV2"] as const).map((fam) => (
              <div key={fam} className="mb-4">
                <div className="text-xs uppercase text-slate-500 mb-1">{fam}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      {["S", "M", "L"].map((h) => (
                        <th key={h} className="py-2 pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(["S", "M", "L"] as const).map((k) => (
                        <td key={`${fam}-${k}`} className="py-2 pr-4 min-w-[140px]">
                          <Input
                            type="number"
                            value={adderCost.pool[fam][k]}
                            onChange={(e) =>
                              setAdderCost((s: any) => ({
                                ...s,
                                pool: { ...s.pool, [fam]: { ...s.pool[fam], [k]: Number(e.target.value || 0) } },
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Solar / UPS (flat) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold mb-2">Solar (flat)</div>
              <Input
                type="number"
                value={adderCost.solar.flat}
                onChange={(e) => setAdderCost((s: any) => ({ ...s, solar: { flat: Number(e.target.value || 0) } }))}
              />
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">UPS (flat)</div>
              <Input
                type="number"
                value={adderCost.ups.flat}
                onChange={(e) => setAdderCost((s: any) => ({ ...s, ups: { flat: Number(e.target.value || 0) } }))}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Changes here immediately update all adder pricing above (bi-directional with the adder cards).
        </p>
      </CardContent>
    </Card>
  );
}
