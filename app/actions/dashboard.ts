"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serialize, ActionResponse } from "@/lib/serialize";

export async function getDashboardData(): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.storeId) {
            return { success: false, error: "Unauthorized" };
        }

        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // 1. Get Active Attendance
        const attendance = await prisma.attendance.findFirst({
            where: {
                userId: session.user.id,
                clockOut: null,
            },
        });

        // 2. Daily Digital Stats (for the user today)
        const digitalStats = await prisma.digitalTransaction.aggregate({
            where: {
                createdBy: session.user.id,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            _count: true,
            _sum: {
                grossAmount: true,
            },
        });

        // 3. Daily Expenditure Stats
        const expenditureStats = await prisma.expenditure.aggregate({
            where: {
                createdBy: session.user.id,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            _count: true,
            _sum: {
                amountFromBill: true,
                amountFromCashier: true,
                amountFromTransfer: true,
            },
        });

        const totalExpenditure = (expenditureStats._sum.amountFromBill || 0) + 
                                 (expenditureStats._sum.amountFromCashier || 0) + 
                                 (expenditureStats._sum.amountFromTransfer || 0);

        return {
            success: true,
            data: {
                attendance: serialize(attendance),
                digital: {
                    count: digitalStats._count || 0,
                    total: digitalStats._sum.grossAmount || 0,
                },
                expenditure: {
                    count: expenditureStats._count || 0,
                    total: totalExpenditure,
                },
            },
        };
    } catch (error: any) {
        console.error("getDashboardData error:", error);
        return { success: false, error: "Gagal memuat data dashboard" };
    }
}
