"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { generateFlipApiKey } from "@/app/actions/flip";
import { toast } from "sonner";
import {
  Key,
  RefreshCw,
  Copy,
  CheckCircle2,
  Code,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from "lucide-react";

interface Props {
  initialApiKey: string | null;
  storeId: string;
  appUrl: string;
}

export default function FlipApiKeySection({ initialApiKey, storeId, appUrl }: Props) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await generateFlipApiKey();
      if (res.success && res.data?.apiKey) {
        setApiKey(res.data.apiKey);
        toast.success("API Key baru berhasil dibuat!");
      } else {
        toast.error(res.error || "Gagal generate API key");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} disalin ke clipboard!`);
    setTimeout(() => setCopied(null), 2000);
  }

  const appsScriptCode = `/**
 * KasirPro — Flip Email Forwarder
 * Pasang di Google Apps Script (script.google.com)
 *
 * 1. Buat project baru di script.google.com
 * 2. Paste seluruh kode ini
 * 3. Klik ▶ Run, lalu Allow permissions
 * 4. Buat Time-driven trigger: forwardFlipEmails → setiap 5 menit
 */

const CONFIG = {
  API_URL: "${appUrl}/api/flip-email",
  API_KEY: "${apiKey || "PASTE_API_KEY_DISINI"}",
  STORE_ID: "${storeId}",
  LABEL_DONE: "FlipSynced", // Label Gmail untuk email yang sudah diproses
  START_DATE: "2026/04/01", // Tanggal awal penarikan data (Format: YYYY/MM/DD)
};

function forwardFlipEmails() {
  // Cari email dari Flip yang belum dilabeli dan setelah tanggal START_DATE
  const query = \`from:no-reply@flip.id subject:"berhasil" after:\${CONFIG.START_DATE} -label:\${CONFIG.LABEL_DONE}\`;
  const threads = GmailApp.search(query, 0, 20);

  if (threads.length === 0) return;

  // Pastikan label ada
  let label = GmailApp.getUserLabelByName(CONFIG.LABEL_DONE);
  if (!label) label = GmailApp.createLabel(CONFIG.LABEL_DONE);

  for (const thread of threads) {
    try {
      const msg = thread.getMessages()[0];
      const subject = msg.getSubject();
      const body = msg.getBody();

      const response = UrlFetchApp.fetch(CONFIG.API_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": CONFIG.API_KEY },
        payload: JSON.stringify({
          subject: subject,
          body: body,
          storeId: CONFIG.STORE_ID,
        }),
        muteHttpExceptions: true,
      });

      const result = JSON.parse(response.getContentText());
      if (result.success) {
        thread.addLabel(label);
        Logger.log("Synced: " + subject);
      } else {
        Logger.log("Failed: " + subject + " — " + result.error);
      }
    } catch (e) {
      Logger.log("Error: " + e.toString());
    }
  }
}`;

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Smartphone className="h-5 w-5 text-orange-600" />
          </div>
          Integrasi Flip Email
        </CardTitle>
        <CardDescription>
          Sinkronisasi otomatis transaksi digital dari email notifikasi Flip.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* API Key */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            API Key
          </Label>
          {apiKey ? (
            <div className="flex items-center gap-2">
              <Input
                value={apiKey}
                readOnly
                className="font-mono text-xs bg-muted/50 h-10"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => handleCopy(apiKey, "API Key")}
              >
                {copied === "API Key" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Belum ada API key. Klik tombol di bawah untuk generate.
            </p>
          )}
          <Button
            variant={apiKey ? "outline" : "default"}
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full gap-2 mt-2"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            {apiKey ? "Generate Ulang" : "Generate API Key"}
          </Button>
          {apiKey && (
            <p className="text-[10px] text-destructive font-medium">
              ⚠️ Generate ulang akan membuat key lama tidak berlaku. Update juga di Apps Script.
            </p>
          )}
        </div>

        <Separator />

        {/* Store ID */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Store ID</Label>
          <div className="flex items-center gap-2">
            <Input
              value={storeId}
              readOnly
              className="font-mono text-xs bg-muted/50 h-10"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => handleCopy(storeId, "Store ID")}
            >
              {copied === "Store ID" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Apps Script Code */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
            onClick={() => setShowScript(!showScript)}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Code className="h-4 w-4 text-muted-foreground" />
              Google Apps Script
              <Badge variant="secondary" className="text-[10px]">Template</Badge>
            </span>
            {showScript ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showScript && (
            <div className="space-y-3">
              <div className="relative">
                <pre className="bg-muted/70 rounded-xl p-4 text-[11px] font-mono overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed border">
                  {appsScriptCode}
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2 h-7 text-[10px] gap-1 rounded-lg"
                  onClick={() => handleCopy(appsScriptCode, "Apps Script")}
                >
                  {copied === "Apps Script" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Salin Kode
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 bg-primary/5 rounded-xl p-3">
                <p className="font-bold text-foreground">Cara Pasang:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>
                    Buka{" "}
                    <a
                      href="https://script.google.com"
                      target="_blank"
                      rel="noopener"
                      className="text-primary underline"
                    >
                      script.google.com
                    </a>
                  </li>
                  <li>Buat Project Baru → Paste kode di atas</li>
                  <li>Klik ▶ Run → Izinkan akses Gmail</li>
                  <li>
                    Buat Trigger: <b>Triggers</b> → Add Trigger →{" "}
                    <code className="bg-muted px-1 rounded text-[10px]">forwardFlipEmails</code> → Time-driven → Every 5 minutes
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
