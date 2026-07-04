import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFlipEmail } from "@/lib/flip-parser";

/**
 * POST /api/flip-email
 *
 * Receives email data from Google Apps Script.
 * Headers: x-api-key (must match store.flipApiKey)
 * Body: 
 *   Single object: { subject: string, body: string, storeId: string }
 *   Or Array: Array<{ subject: string, body: string, storeId: string }>
 *
 * Idempotent: if flipId already exists for the store, updates the record (upsert).
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing x-api-key header" },
        { status: 401 }
      );
    }

    const json = await req.json();
    const items = Array.isArray(json) ? json : [json];

    if (items.length === 0) {
      return NextResponse.json({ success: true, processed: 0, data: [] });
    }

    // All items in a batch must belong to the same store
    const firstStoreId = items[0]?.storeId;
    if (!firstStoreId) {
      return NextResponse.json(
        { success: false, error: "Missing storeId in payload" },
        { status: 400 }
      );
    }

    // Validate API key against the store
    const store = await prisma.store.findUnique({
      where: { id: firstStoreId },
      select: { flipApiKey: true },
    });

    if (!store || !store.flipApiKey || store.flipApiKey !== apiKey) {
      return NextResponse.json(
        { success: false, error: "Invalid API key for this store" },
        { status: 403 }
      );
    }

    const results = [];
    const failed = [];

    for (const item of items) {
      const { subject, body, storeId } = item as {
        subject?: string;
        body?: string;
        storeId?: string;
      };

      if (!subject || !body || !storeId) {
        failed.push({
          subject: subject || "Unknown Subject",
          error: "Missing required fields: subject, body, storeId",
        });
        continue;
      }

      if (storeId !== firstStoreId) {
        failed.push({
          subject,
          error: "storeId mismatch in batch",
        });
        continue;
      }

      // Parse email content
      const parsed = parseFlipEmail(subject, body);
      if (!parsed) {
        failed.push({
          subject,
          error: "Could not parse Flip transaction from email",
        });
        continue;
      }

      // Upsert — idempotent by flipId + storeId
      const record = await prisma.flipWebhook.upsert({
        where: {
          flipId_storeId: {
            flipId: parsed.flipId,
            storeId,
          },
        },
        update: {
          nominal: parsed.nominal,
          transactionTime: parsed.transactionTime,
          customerName: parsed.customerName,
          customerNumber: parsed.customerNumber,
          bankOrProvider: parsed.bankOrProvider,
          emailSubject: parsed.emailSubject,
        },
        create: {
          storeId,
          flipId: parsed.flipId,
          serviceType: parsed.serviceType,
          nominal: parsed.nominal,
          customerName: parsed.customerName,
          customerNumber: parsed.customerNumber,
          bankOrProvider: parsed.bankOrProvider,
          transactionTime: parsed.transactionTime,
          emailSubject: parsed.emailSubject,
        },
      });

      results.push({
        id: record.id,
        flipId: record.flipId,
        serviceType: record.serviceType,
        nominal: record.nominal,
        transactionTime: record.transactionTime,
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      failed: failed.length,
      data: results,
      errors: failed.length > 0 ? failed : undefined,
    });
  } catch (error: any) {
    console.error("flip-email API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
