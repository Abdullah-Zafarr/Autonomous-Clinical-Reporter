import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type {
  ThyroidData,
  ThyroidNodule,
  NoduleLocation,
  NoduleComposition,
  NoduleEchogenicity,
  NoduleShape,
  NoduleMargin,
  NoduleEchogenicFoci,
  TiRads,
  LobeDimensions,
  ThyroidParenchyma,
  ThyroidVascularity,
  CervicalNode,
} from "@/lib/sonoflow-types";

interface Props {
  data: ThyroidData;
  onChange: (d: ThyroidData) => void;
  isDoctorMode?: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function LobeInputs({
  value,
  onChange,
}: {
  value: LobeDimensions;
  onChange: (v: LobeDimensions) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field label="L (cm)">
        <Input
          inputMode="decimal"
          placeholder="4.5"
          className="h-8 text-xs"
          value={value.length}
          onChange={(e) => onChange({ ...value, length: e.target.value })}
        />
      </Field>
      <Field label="W (cm)">
        <Input
          inputMode="decimal"
          placeholder="1.8"
          className="h-8 text-xs"
          value={value.width}
          onChange={(e) => onChange({ ...value, width: e.target.value })}
        />
      </Field>
      <Field label="D (cm)">
        <Input
          inputMode="decimal"
          placeholder="1.5"
          className="h-8 text-xs"
          value={value.depth}
          onChange={(e) => onChange({ ...value, depth: e.target.value })}
        />
      </Field>
    </div>
  );
}

const tiradsColor: Record<TiRads, string> = {
  TR1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TR2: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TR3: "bg-amber-100 text-amber-700 border-amber-200",
  TR4: "bg-orange-100 text-orange-700 border-orange-200",
  TR5: "bg-red-100 text-red-700 border-red-200",
};

export function ThyroidWorksheet({ data, onChange, isDoctorMode = false }: Props) {
  const addNodule = () => {
    const newNodule: ThyroidNodule = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      location: "Right",
      size: "",
      composition: "Solid",
      echogenicity: "Hyperechoic/Isoechoic",
      shape: "Wider-than-tall",
      margin: "Smooth",
      echogenicFoci: "None",
      tirads: "TR3",
    };
    onChange({ ...data, nodules: [...data.nodules, newNodule] });
  };

  const updateNodule = (id: string, patch: Partial<ThyroidNodule>) => {
    onChange({
      ...data,
      nodules: data.nodules.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const removeNodule = (id: string) => {
    onChange({ ...data, nodules: data.nodules.filter((n) => n.id !== id) });
  };

  return (
    <Accordion
      type="multiple"
      defaultValue={["dimensions", "gland-pattern", "nodes", "nodules"]}
      className="space-y-2"
    >
      <AccordionItem value="dimensions" className="rounded-lg border bg-card px-3 sm:px-3.5">
        <AccordionTrigger className="py-2.5 text-sm font-semibold hover:no-underline">Gland Dimensions</AccordionTrigger>
        <AccordionContent className="space-y-2.5 pt-1 pb-2.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Right Lobe</Label>
            <LobeInputs
              value={data.rightLobe}
              onChange={(v) => onChange({ ...data, rightLobe: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Left Lobe</Label>
            <LobeInputs
              value={data.leftLobe}
              onChange={(v) => onChange({ ...data, leftLobe: v })}
            />
          </div>
          <Field label="Isthmus thickness (mm)">
            <Input
              inputMode="decimal"
              placeholder="e.g. 3.2"
              className="h-8 max-w-[160px] text-xs"
              value={data.isthmus}
              onChange={(e) => onChange({ ...data, isthmus: e.target.value })}
            />
          </Field>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="gland-pattern" className="rounded-lg border bg-card px-3 sm:px-3.5">
        <AccordionTrigger className="py-2.5 text-sm font-semibold hover:no-underline">Parenchyma & Vascularity</AccordionTrigger>
        <AccordionContent className="space-y-2.5 pt-1 pb-2.5">
          <Field label="Parenchyma">
            <Select
              value={data.parenchyma}
              onValueChange={(v) => onChange({ ...data, parenchyma: v as ThyroidParenchyma })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Homogeneous">Homogeneous</SelectItem>
                <SelectItem value="Mildly heterogeneous">Mildly heterogeneous</SelectItem>
                <SelectItem value="Markedly heterogeneous">Markedly heterogeneous</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vascularity">
            <Select
              value={data.vascularity}
              onValueChange={(v) => onChange({ ...data, vascularity: v as ThyroidVascularity })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Increased">Increased</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="nodes" className="rounded-lg border bg-card px-3 sm:px-3.5">
        <AccordionTrigger className="py-2.5 text-sm font-semibold hover:no-underline">Cervical Lymph Nodes</AccordionTrigger>
        <AccordionContent className="space-y-2.5 pt-1 pb-2.5">
          <Field label="Suspicious Nodes">
            <Select
              value={data.cervicalNodes}
              onValueChange={(v) => onChange({ ...data, cervicalNodes: v as CervicalNode })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="None suspicious">None suspicious</SelectItem>
                <SelectItem value="Suspicious right">Suspicious right</SelectItem>
                <SelectItem value="Suspicious left">Suspicious left</SelectItem>
                <SelectItem value="Suspicious bilateral">Suspicious bilateral</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="nodules" className="rounded-lg border bg-card px-3 sm:px-3.5">
        <AccordionTrigger className="py-2.5 text-sm font-semibold hover:no-underline">
          <div className="flex items-center gap-2">
            <span>Nodules</span>
            {data.nodules.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {data.nodules.length}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-2.5 pt-1 pb-2.5">
          {data.nodules.length === 0 && (
            <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              No nodules added. Click below to track a finding.
            </p>
          )}

          {data.nodules.map((n, idx) => (
            <Card key={n.id} className="space-y-3 border-l-4 border-l-primary p-3 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Nodule #{idx + 1}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${tiradsColor[n.tirads]}`}
                  >
                    {n.tirads}
                  </span>
                </div>
                {!isDoctorMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeNodule(n.id)}
                    aria-label={`Delete nodule ${idx + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Location">
                  <Select
                    value={n.location}
                    onValueChange={(v) => updateNodule(n.id, { location: v as NoduleLocation })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Right">Right</SelectItem>
                      <SelectItem value="Left">Left</SelectItem>
                      <SelectItem value="Isthmus">Isthmus</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Size (cm)">
                  <Input
                    inputMode="decimal"
                    placeholder="1.2"
                    className="h-8 text-xs"
                    value={n.size}
                    onChange={(e) => updateNodule(n.id, { size: e.target.value })}
                  />
                </Field>
                <Field label="Composition">
                  <Select
                    value={n.composition}
                    onValueChange={(v) => updateNodule(n.id, { composition: v as NoduleComposition })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solid">Solid</SelectItem>
                      <SelectItem value="Cystic">Cystic</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Echogenicity">
                  <Select
                    value={n.echogenicity}
                    onValueChange={(v) => updateNodule(n.id, { echogenicity: v as NoduleEchogenicity })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Anechoic">Anechoic</SelectItem>
                      <SelectItem value="Hyperechoic/Isoechoic">Hyperechoic/Isoechoic</SelectItem>
                      <SelectItem value="Hypoechoic">Hypoechoic</SelectItem>
                      <SelectItem value="Very hypoechoic">Very hypoechoic</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Shape">
                  <Select
                    value={n.shape}
                    onValueChange={(v) => updateNodule(n.id, { shape: v as NoduleShape })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wider-than-tall">Wider-than-tall</SelectItem>
                      <SelectItem value="Taller-than-wide">Taller-than-wide</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Margin">
                  <Select
                    value={n.margin}
                    onValueChange={(v) => updateNodule(n.id, { margin: v as NoduleMargin })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Smooth">Smooth</SelectItem>
                      <SelectItem value="Ill-defined">Ill-defined</SelectItem>
                      <SelectItem value="Lobulated/Irregular">Lobulated/Irregular</SelectItem>
                      <SelectItem value="Extrathyroidal extension">Extrathyroidal extension</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Echogenic Foci">
                  <Select
                    value={n.echogenicFoci}
                    onValueChange={(v) => updateNodule(n.id, { echogenicFoci: v as NoduleEchogenicFoci })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Comet-tail artifacts">Comet-tail artifacts</SelectItem>
                      <SelectItem value="Macrocalcifications">Macrocalcifications</SelectItem>
                      <SelectItem value="Peripheral rim calcifications">Peripheral rim calcifications</SelectItem>
                      <SelectItem value="Punctate echogenic foci">Punctate echogenic foci</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="TI-RADS">
                  <Select
                    value={n.tirads}
                    onValueChange={(v) => updateNodule(n.id, { tirads: v as TiRads })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TR1">TR1 — Benign</SelectItem>
                      <SelectItem value="TR2">TR2 — Not suspicious</SelectItem>
                      <SelectItem value="TR3">TR3 — Mildly suspicious</SelectItem>
                      <SelectItem value="TR4">TR4 — Moderately suspicious</SelectItem>
                      <SelectItem value="TR5">TR5 — Highly suspicious</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Card>
          ))}

          {!isDoctorMode && (
            <Button variant="outline" size="sm" onClick={addNodule} className="w-full">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Nodule
            </Button>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
