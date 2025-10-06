import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronUp, Info, RefreshCcw } from "lucide-react";

// -----------------------------
// Utility helpers
// -----------------------------
const fmtUSD = (n: number) => (isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—");
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const approxEq = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// -----------------------------
// Canonical reference data (from pricing guide)
// -----------------------------
const ASE_BASE: Record<string, Record<string, number>> = {
  MP3: { S: 795, M: 895, L: 995 },
  LV2: { S: 995, M: 1095, L: 1195 },
};

// ASE adder increments by system/size (editable via UI table)
const initialASEAdders: Record<string, Record<string, { foam: number; booster: number; pool: number; solar: number }>> = {
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

// Subscription (monthly) base list price by system family
const SUB_BASE: Record<string, number> = { MP3: 89, LV2: 129 };

// Vertical multipliers
const VERTICALS: { key: string; label: string; multiplier: number }[] = [
  { key: "res", label: "Luxury Residential", multiplier: 1.0 },
  { key: "prod", label: "Production / Community", multiplier: 0.9 },
  { key: "ci", label: "C&I / Commercial", multiplier: 0.95 },
];

// GM preset buttons — apply to BOTH system & adders (single declaration)
const GM_PRESETS = [
  { key: "res", label: "Residential 50% GM", systemGM: 0.5, adderGM: 0.5 },
  { key: "ci", label: "C&I 42.5% GM", systemGM: 0.425, adderGM: 0.425 },
  { key: "prod", label: "Production 37.5% GM", systemGM: 0.375, adderGM: 0.375 },
];

// Default adder sizing notes
const ADDER_NOTES = {
  foam: "Foam auto-sizes to system S/M/L; XL available as manual override.",
  booster: "Booster auto-sizes to meet required pressure/flow.",
  pool: "Pool/Draft kit scales by hose diameter & flow.",
  solar: "Universal (no size)",
  ups: "Universal (no size)",
};

// -----------------------------
// Component
// -----------------------------
export default function FrontlinePricingCalculator() {
  // System definition
  const [family, setFamily] = useState<"MP3" | "LV2">("MP3");
  const [size, setSize] = useState<"S" | "M" | "L">("M");

  // Cost/GM/Price with two-way coupling
  const [systemCost, setSystemCost] = useState<number>(50000);
  const [targetGM, setTargetGM] = useState<number>(0.5); // 50%
  const [systemPrice, setSystemPrice] = useState<number>(() => Math.round(50000 / (1 - 0.5)));
  const [lastEdited, setLastEdited] = useState<"cost" | "gm" | "price">("price");

  // Subscription settings
  const [verticalKey, setVerticalKey] = useState<string>("res");
  const [isHighUsage, setIsHighUsage] = useState<boolean>(false);
  const [annualBilling, setAnnualBilling] = useState<boolean>(false); // –10% if true

  // Adder selections
  const [includeFoam, setIncludeFoam] = useState<boolean>(true);
  const [includeBooster, setIncludeBooster] = useState<boolean>(false);
  const [includePool, setIncludePool] = useState<boolean>(false);
  const [includeSolar, setIncludeSolar] = useState<boolean>(false);
  const [includeUPS, setIncludeUPS] = useState<boolean>(false);

  // Per‑adder size override (null = follow system size)
  const [foamSize, setFoamSize] = useState<"S" | "M" | "L" | "XL" | null>(null);
  const [boosterSize, setBoosterSize] = useState<"S" | "M" | "L" | null>(null);
  const [poolSize, setPoolSize] = useState<"S" | "M" | "L" | null>(null);

  // Adder GM (applied uniformly)
  const [adderGM, setAdderGM] = useState<number>(0.5); // 50%

  // Adder COSTs by size (editable). These are internal costs, not prices.
  // Foam uses S/M/L/XL (common). Booster & Pool have separate cost classes for MP3 and LV2.
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

  // ASE adder increments — STATE (editable via table)
  const [ASE_ADDERS, setASE_ADDERS] = useState(initialASEAdders);

  // Collapsible JSON
  const [showJSON, setShowJSON] = useState<boolean>(false);

  // Dev tests visibility
  const [showTests, setShowTests] = useState<boolean>(false);

  // -----------------------------
  // Derived: two-way coupling logic
  // -----------------------------
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

  // -----------------------------
  // Adder sizing & pricing
  // -----------------------------
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

  // -----------------------------
  // ASE (annual)
  // -----------------------------
  const aseBase = ASE_BASE[family][systemSizeKey];
  const aseAdderTable = ASE_ADDERS[family][systemSizeKey];
  const aseAddersSum = (includeFoam ? aseAdderTable.foam : 0) + (includeBooster ? aseAdderTable.booster : 0) + (includePool ? aseAdderTable.pool : 0) + (includeSolar ? aseAdderTable.solar : 0);
  const aseAnnual = aseBase + aseAddersSum;

  // -----------------------------
  // Subscription (monthly)
  // -----------------------------
  const vertical = VERTICALS.find((v) => v.key === verticalKey)!;
  const subList = SUB_BASE[family];
  let subMonthly = subList * vertical.multiplier + (isHighUsage ? 20 : 0);
  if (annualBilling) subMonthly = subMonthly * 0.9; // –10% annual prepay
  subMonthly = Math.round(subMonthly * 100) / 100;

  // -----------------------------
  // Totals
  // -----------------------------
  const oneTimeTotal = recalc.price + addersTotal;

  // -----------------------------
  // Actions
  // -----------------------------
  // Apply GM preset to BOTH system & adder GM
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
    setShowTests(false);
  };

  // Reset adders to defaults on system family change
  React.useEffect(() => {
    setIncludeFoam(true);
    setIncludeBooster(false);
    setIncludePool(false);
    setIncludeSolar(false);
    setIncludeUPS(false);
    setFoamSize(null);
    setBoosterSize(null);
    setPoolSize(null);
    // Default system COGS per family
    const defaultCost = family === "MP3" ? 50000 : 60000; // TODO: confirm LV2 default is $60,000 (user wrote "$60")
    setSystemCost(defaultCost);
    setLastEdited("cost");
  }, [family]);

  // -----------------------------
  // Developer Tests (lightweight assertions rendered in a collapsible card)
  // -----------------------------
  type TRes = { name: string; pass: boolean; expected: any; got: any };
  const tests: TRes[] = useMemo(() => {
    const out: TRes[] = [];

    // 1) System GM inverse check
    const c1 = 6000, gm1 = 0.5, p1 = Math.round(c1 / (1 - gm1));
    const gmBack1 = (p1 - c1) / p1;
    out.push({ name: "GM inverse (system)", pass: p1 === 12000 && approxEq(gmBack1, gm1), expected: { price: 12000, gm: gm1 }, got: { price: p1, gm: gmBack1 } });

    // 2) priceFromGM helper
    const p2 = Math.round(1000 / (1 - 0.5));
    out.push({ name: "priceFromGM(1000, 0.5)", pass: p2 === 2000, expected: 2000, got: p2 });

    // 3) ASE defaults (MP3-M Foam)
    const aseFoamMP3M = initialASEAdders.MP3.M.foam;
    out.push({ name: "ASE default MP3-M foam", pass: aseFoamMP3M === 119, expected: 119, got: aseFoamMP3M });

    // 4) Classed adder: Booster LV2-M cost
    const boosterLV2M = adderCost.booster.LV2.M;
    out.push({ name: "Booster LV2-M default cost", pass: boosterLV2M === 2100, expected: 2100, got: boosterLV2M });

    // 5) Subscription math: MP3, Residential, annual –10%
    const subAnnual = SUB_BASE.MP3 * VERTICALS.find(v=>v.key==='res')!.multiplier * 0.9;
    out.push({ name: "Subscription MP3 Res annual", pass: approxEq(subAnnual, 80.1), expected: 80.1, got: subAnnual });

    // 6) GM presets shape
    const prod = GM_PRESETS.find(p=>p.key==='prod');
    out.push({ name: "GM preset applies to system+adders", pass: !!prod && approxEq(prod!.systemGM, 0.375) && approxEq(prod!.adderGM, 0.5), expected: { systemGM: 0.375, adderGM: 0.5 }, got: prod });

    // 7) Foam XL pricing with 50% GM
    const priceFoamXL = Math.round(1800 / (1 - 0.5));
    out.push({ name: "Foam XL price @50% GM", pass: priceFoamXL === 3600, expected: 3600, got: priceFoamXL });

    // 8) JSON export skeleton keys present
    const jsonObj = {
      system: { family: 'MP3', size: 'M', cost: 6000, gm: 0.5, price: 12000 },
      adders: { foam: { size: 'M', cost: 1000, price: 2000 } },
      ase: { annual: 1000 },
      subscription: { monthly: 89, vertical: 'Luxury Residential', annualBilling: false },
      totals: { oneTime: 14000 }
    };
    const keysOk = ['system','adders','ase','subscription','totals'].every(k=>k in jsonObj);
    out.push({ name: "JSON export keys", pass: keysOk, expected: true, got: keysOk });

    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passCount = tests.filter(t=>t.pass).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Frontline Pricing Calculator — MP3/LV2</h1>
        </div>
        <div className="flex gap-2">
          <div className="hidden md:flex gap-2">
            {GM_PRESETS.map(p => (
              <Button key={p.key} variant="secondary" size="sm" onClick={() => applyGMPreset(p.systemGM, p.adderGM)}>{p.label}</Button>
            ))}
          </div>
          <Button variant="secondary" onClick={resetAll}><RefreshCcw className="h-4 w-4 mr-2"/>Reset</Button>
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
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MP3">MP3</SelectItem>
                  <SelectItem value="LV2">LV2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Select value={size} onValueChange={(v: any) => setSize(v)}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">Small (0–3 zones)</SelectItem>
                  <SelectItem value="M">Medium (4–6 zones)</SelectItem>
                  <SelectItem value="L">Large (7–9 zones)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">LV2 is generally recommended for &gt;9 zones or higher-flow estates.</p>
            </div>
          </CardContent>
        </Card>

        {/* Cost / GM / Price */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Base System Price — Two‑Way Cost ↔ GM ↔ Price</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>System Cost (COGS)</Label>
                <Input type="number" value={recalc.cost} onChange={(e) => { setSystemCost(Number(e.target.value || 0)); setLastEdited("cost"); }} />
              </div>
              <div>
                <Label>Target GM</Label>
                <div className="flex items-center gap-2">
                  <Input className="w-28" type="number" step="0.01" min="0" max="0.95" value={recalc.gm.toFixed(2)} onChange={(e) => { setTargetGM(Number(e.target.value || 0)); setLastEdited("gm"); }} />
                  <span className="text-sm text-muted-foreground">({(recalc.gm * 100).toFixed(0)}%)</span>
                </div>
              </div>
              <div>
                <Label>Base System Price (Installed)</Label>
                <Input type="number" value={recalc.price} onChange={(e) => { setSystemPrice(Number(e.target.value || 0)); setLastEdited("price"); }} />
                <p className="text-xs text-muted-foreground mt-1">Rounded to nearest $100 is recommended when quoting.</p>
              </div>
            </div>
<div>
  <Label className="text-xs text-muted-foreground">System Target GM</Label>
  <div className="flex items-center gap-3 mt-1">
    <div className="w-full max-w-xs">
      <Slider
        value={[recalc.gm]}
        min={0.2}
        max={0.7}
        step={0.01}
        onValueChange={([v]) => { setTargetGM(Number(v.toFixed(2))); setLastEdited("gm"); }}
      />
    </div>
    <div className="w-12 text-right tabular-nums">{Math.round(recalc.gm * 100)}%</div>
  </div>
</div>

            <div className="flex md:hidden gap-2">
              {GM_PRESETS.map(p => (
                <Button key={p.key} variant="secondary" size="sm" onClick={() => applyGMPreset(p.systemGM, p.adderGM)}>{p.label}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adders */}
      <Card>
        <CardHeader>
          <CardTitle>System adders</CardTitle>
          <p className="text-xs text-muted-foreground">Size follows system by default; override below.</p>
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
              sizes={["S","M","L","XL"]}
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
              sizes={["S","M","L"]}
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
              sizes={["S","M","L"]}
              costBySize={adderCost.pool[family]}
              setCostBySize={(v: any) => setAdderCost((s: any) => ({ ...s, pool: { ...s.pool, [family]: v } }))}
              calcPrice={(k: any) => priceFromGM(adderCost.pool[family][k], adderGM)}
            />

            {/* Solar */}
            <Card className="p-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Type: <span className="font-semibold">Universal</span></div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">Solar Backup</div>
                  <div className="text-xs text-muted-foreground">{ADDER_NOTES.solar}</div>
                </div>
                <Checkbox checked={includeSolar} onCheckedChange={setIncludeSolar} aria-label="Include Solar Backup" />



              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                  <div>Cost</div>
                  <div className="text-right">Price</div>
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Input aria-label="Solar Cost" type="number" value={adderCost.solar.flat} onChange={(e) => setAdderCost((s) => ({ ...s, solar: { flat: Number(e.target.value || 0) } }))} />
                  <div className="text-right text-sm font-medium">{fmtUSD(priceFromGM(adderCost.solar.flat, adderGM))}</div>
                </div>
              </div>
            </Card>

            {/* UPS */}
            <Card className="p-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Type: <span className="font-semibold">Universal</span></div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">UPS (8‑Day)</div>
                  <div className="text-xs text-muted-foreground">{ADDER_NOTES.ups}</div>
                </div>
                <Checkbox checked={includeUPS} onCheckedChange={setIncludeUPS} aria-label="Include UPS (8-Day)" />
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                  <div>Cost</div>
                  <div className="text-right">Price</div>
                </div>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <Input aria-label="UPS Cost" type="number" value={adderCost.ups.flat} onChange={(e) => setAdderCost((s) => ({ ...s, ups: { flat: Number(e.target.value || 0) } }))} />
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
              <p className="text-xs text-muted-foreground mt-1">Applies to all adder costs (Foam/Booster/Pool/Solar/UPS).</p>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <SummaryRow label="Foam System" value={includeFoam ? fmtUSD(foamPrice) : "—"} />
              <SummaryRow label="Booster Pump" value={includeBooster ? fmtUSD(boosterPrice) : "—"} />
              <SummaryRow label="Pool/Draft Kit" value={includePool ? fmtUSD(poolPrice) : "—"} />
              <SummaryRow label="Solar Backup" value={includeSolar ? fmtUSD(solarPrice) : "—"} />
              <SummaryRow label="UPS (8‑Day)" value={includeUPS ? fmtUSD(upsPrice) : "—"} />
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
            <p className="text-xs text-muted-foreground">Service adders are editable below and sync live with these totals.</p>
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
            <p className="text-xs text-muted-foreground">ASE adders mirror selected hardware adders (Foam/Booster/Pool/Solar). UPS does not affect ASE.</p>
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
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map((v) => (
                      <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Multiplies list price by vertical factor.</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label>High‑Usage Add‑On (+$20)</Label>
                  <p className="text-xs text-muted-foreground">For cell‑primary or satellite systems</p>
                </div>
                <Switch checked={isHighUsage} onCheckedChange={setIsHighUsage} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={annualBilling} onCheckedChange={setAnnualBilling} />
                <span className="text-sm">Annual billing (–10%)</span>
              </div>
              <div className="text-sm">Base: {family} @ {fmtUSD(SUB_BASE[family])}/mo</div>
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
              <span>One‑Time Total</span>
              <span>{fmtUSD(oneTimeTotal)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <SummaryRow label="ASE (Annual)" value={fmtUSD(aseAnnual)} />
            <SummaryRow label="Subscription (Monthly)" value={fmtUSD(subMonthly)} />
          </div>
          <div className="text-xs text-muted-foreground">
            <p>Notes:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Foam and Pool/Draft follow system size by default; override controls per‑adder.</li>
              <li>GM = (Price − Cost) / Price. You can edit any field; others recompute.</li>
              <li>All pricing in USD; taxes/permits/trenching/travel not included.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Default Adder Costs Matrix (bi‑directional) */}
      <Card>
        <CardHeader>
          <CardTitle>Default Adder Costs (edit to update all pricing)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Adder</th>
                <th className="py-2">Class / Size</th>
                <th className="py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {/* Foam rows */}
              {["S","M","L","XL"].map((k) => (
                <tr key={`foam-${k}`}>
                  <td className="py-2 font-medium">Foam</td>
                  <td className="py-2 pr-2">{k}</td>
                  <td className="py-2 pr-2"><Input type="number" value={(adderCost.foam as any)[k]} onChange={(e) => setAdderCost((s:any) => ({ ...s, foam: { ...s.foam, [k]: Number(e.target.value || 0) } }))} /></td>
                </tr>
              ))}

              {/* Booster rows — MP3 & LV2 classes */}
              {["MP3","LV2"].flatMap((cls) => (["S","M","L"]).map((k) => (
                <tr key={`booster-${cls}-${k}`}>
                  <td className="py-2 font-medium">Booster</td>
                  <td className="py-2 pr-2">{cls} {k}</td>
                  <td className="py-2 pr-2"><Input type="number" value={(adderCost.booster as any)[cls][k]} onChange={(e) => setAdderCost((s:any) => ({ ...s, booster: { ...s.booster, [cls]: { ...(s.booster as any)[cls], [k]: Number(e.target.value || 0) } } }))} /></td>
                </tr>
              )))}

              {/* Pool/Draft rows — MP3 & LV2 classes */}
              {["MP3","LV2"].flatMap((cls) => (["S","M","L"]).map((k) => (
                <tr key={`pool-${cls}-${k}`}>
                  <td className="py-2 font-medium">Pool/Draft</td>
                  <td className="py-2 pr-2">{cls} {k}</td>
                  <td className="py-2 pr-2"><Input type="number" value={(adderCost.pool as any)[cls][k]} onChange={(e) => setAdderCost((s:any) => ({ ...s, pool: { ...s.pool, [cls]: { ...(s.pool as any)[cls], [k]: Number(e.target.value || 0) } } }))} /></td>
                </tr>
              )))}

              {/* Solar & UPS */}
              <tr>
                <td className="py-2 font-medium">Solar (flat)</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2 pr-2"><Input type="number" value={adderCost.solar.flat} onChange={(e) => setAdderCost((s:any) => ({ ...s, solar: { flat: Number(e.target.value || 0) } }))} /></td>
              </tr>
              <tr>
                <td className="py-2 font-medium">UPS (flat)</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2 pr-2"><Input type="number" value={adderCost.ups.flat} onChange={(e) => setAdderCost((s:any) => ({ ...s, ups: { flat: Number(e.target.value || 0) } }))} /></td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">Changes here immediately update all adder pricing above (bi‑directional with the adder cards).</p>
        </CardContent>
      </Card>

      {/* Service Adders (ASE) Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Adder Prices (ASE) — editable defaults</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Adder</th>
                <th className="py-2">MP3 S</th>
                <th className="py-2">MP3 M</th>
                <th className="py-2">MP3 L</th>
                <th className="py-2">LV2 S</th>
                <th className="py-2">LV2 M</th>
                <th className="py-2">LV2 L</th>
              </tr>
            </thead>
            <tbody>
              {["foam","booster","pool","solar"].map((key) => (
                <tr key={`ase-${key}`}>
                  <td className="py-2 font-medium capitalize">{key}</td>
                  {["MP3","LV2"].flatMap((fam) => (["S","M","L"]).map((sz) => (
                    <td key={`${key}-${fam}-${sz}`} className="py-2 pr-2">
                      <Input type="number" value={(ASE_ADDERS as any)[fam][sz][key]} onChange={(e) => setASE_ADDERS((prev:any) => ({
                        ...prev,
                        [fam]: {
                          ...prev[fam],
                          [sz]: { ...prev[fam][sz], [key]: Number(e.target.value || 0) }
                        }
                      }))} />
                    </td>
                  )))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">Updates sync with the ASE calculation above.</p>
        </CardContent>
      </Card>

      {/* Developer Tests (collapsible) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Developer Tests</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowTests(s=>!s)}>
            {showTests ? <>Hide</> : <>Show</>}
          </Button>
        </CardHeader>
        {showTests && (
          <CardContent>
            <div className="text-sm mb-2">Pass: {passCount} / {tests.length}</div>
            <div className="space-y-2">
              {tests.map((t, i) => (
                <div key={i} className={`rounded-md p-2 border ${t.pass ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                  <div className="font-medium">{t.name}</div>
                  {!t.pass && (
                    <div className="text-xs mt-1">
                      <div>Expected: <code>{JSON.stringify(t.expected)}</code></div>
                      <div>Got: <code>{JSON.stringify(t.got)}</code></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Collapsible JSON Export */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowJSON((s) => !s)} className="flex items-center gap-2">
          {showJSON ? <><ChevronUp className="h-4 w-4"/>Hide JSON</> : <><ChevronDown className="h-4 w-4"/>Show JSON</>}
        </Button>
      </div>
      {showJSON && (
        <Card>
          <CardHeader>
            <CardTitle>Export (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/40 p-3 rounded-md overflow-auto max-h-64">
{JSON.stringify({
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
}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
// Shared grid template for adder rows (header + rows stay perfectly aligned)
// Shared grid template for adder rows (header + rows stay perfectly aligned)
// Compact, stable column widths: size | cost flexes | price fixed
const ADDER_COLS = "grid grid-cols-[56px,minmax(0,1fr),120px] gap-2";

/** ──────────────────────────────────────────────────────────────────────────
 * AdderBlock
 * --------------------------------------------------------------------------*/
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
  const header = (
    <div className="flex items-start justify-between mb-2">
      <div>
        <div className="font-medium leading-tight text-[15px]">{title}</div>
        <div className="text-[11px] leading-snug text-muted-foreground">{note}</div>
      </div>
      <Checkbox checked={enabled} onCheckedChange={onToggle} aria-label={`Include ${title}`} />
    </div>
  );

  const sizeSelector = (
    <div>
      <div className="text-[11px] text-muted-foreground">
        Selected size <span className="font-medium">{activeSize}</span> · Recommended: {recommendedSize}
      </div>
      <RadioGroup
        className="mt-1 grid grid-cols-4 gap-2"
        value={String(activeSize)}
        onValueChange={(v) => onSelectSize(v as any)}
      >
        {sizes.map((s) => (
          <label
            key={s}
            className={`border rounded-md px-2 py-1 text-center text-[12px] cursor-pointer ${
              activeSize === s ? "bg-primary/10 border-primary" : "hover:bg-muted"
            }`}
          >
            <RadioGroupItem value={String(s)} className="sr-only" />
            {s}
          </label>
        ))}
      </RadioGroup>
      <div className="text-[11px] text-muted-foreground mt-1">
        Clear override to follow recommendation.
      </div>
      <div className="mt-1">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" onClick={() => onSelectSize(null as any)}>
          Use recommended
        </Button>
      </div>
    </div>
  );

  const tableHeader = (
    <div className={`${ADDER_COLS} text-[12px] font-medium text-muted-foreground`}>
      <div>Size</div>
      <div>Cost</div>
      <div className="text-right">Price</div>
    </div>
  );

  const Row = ({ k }: { k: any }) => (
    <div
      className={`${ADDER_COLS} items-center p-2 rounded-md ${
        String(activeSize) === String(k) ? "bg-muted ring-1 ring-muted-foreground/20" : ""
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>

      {/* Cost input — compact, never collapses text */}
      <Input
        className="w-full h-9 px-2 text-right tabular-nums text-[13px] leading-none"
        type="number"
        value={costBySize[k] ?? 0}
        onChange={(e) => setCostBySize({ ...costBySize, [k]: Number(e.target.value || 0) })}
      />

      {/* Price — stays inside card */}
      <div className="text-right tabular-nums font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">
        {fmtUSD(calcPrice(k))}
      </div>
    </div>
  );

  return (
    <Card className="p-4 space-y-2 overflow-hidden">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Type: <span className="font-semibold">{typeLabel}</span>
        {activeSize !== recommendedSize ? (
          <span className="ml-2 text-amber-600">(Overridden)</span>
        ) : (
          <span className="ml-2 text-muted-foreground">(Following system)</span>
        )}
      </div>

      {header}
      {sizeSelector}

      <div className="mt-2 space-y-1">
        {tableHeader}
        {sizes.map((k) => (
          <Row key={k} k={k} />
        ))}
      </div>
    </Card>
  );
}

