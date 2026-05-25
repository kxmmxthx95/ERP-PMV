"use client"

import { format } from "date-fns"
import { th } from "date-fns/locale"

import { Calendar } from "@/components/ui/calendar"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

interface SemesterCalendarProps {
    semesterStartDate: Date
    semesterEndDate: Date
}

export function SemesterCalendar({
    semesterStartDate,
    semesterEndDate,
}: SemesterCalendarProps) {
    const range = { from: semesterStartDate, to: semesterEndDate }

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
                <Calendar
                    mode="range"
                    selected={range}
                    defaultMonth={semesterStartDate}
                    numberOfMonths={2}
                    className="rounded-md border p-3"
                />
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>วันเปิดภาคเรียน</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {format(semesterStartDate, "d MMMM yyyy", { locale: th })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>วันปิดภาคเรียน</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {format(semesterEndDate, "d MMMM yyyy", { locale: th })}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}