import { FastifyInstance } from 'fastify'
import { prisma } from './lib/prisma'
import {z} from 'zod'
import dayjs from 'dayjs'

export async function appRoutes(app: FastifyInstance) {
    app.post('/habits', async (request) => {
        const createHabitBody = z.object({
            title : z.string(),
            weekDays: z.array(
                z.number().min(0).max(6)
            )
        })

        const {title, weekDays} = createHabitBody.parse(request.body)

        const today = dayjs().startOf('day').toDate()

        await prisma.habit.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return{
                            week_day: weekDay,
                        }
                    })
                }
            }
        })
    })

    app.get('/day', async (request) => {
        const getDayParams = z.object({
            date: z.coerce.date()
        })

        const { date } = getDayParams.parse(request.query)

        const parsedDate = dayjs(date).startOf('day')
        const weekDay = dayjs(parsedDate).get('day')

        console.log(date, weekDay)
        //Queremos:
        // - Todos os hábitos possíveis
        // - Hábitos que já foram completados

        const possibleHabits = await prisma.habit.findMany({
            where: {
                created_at: {
                    lte: date,
                },
                weekDays: {
                    some: {
                        week_day: weekDay
                    }
                }
            }
        })

        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate(),
            },
            include: {
                dayHabits: true,
            }
        })

        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id
        })

        return{
            possibleHabits,
            completedHabits,
        }
    })

    // completar / não-completar um hábito

    app.patch('/habits/:id/toggle', async (request) => {
        // routes param => parametro de identificação

        const toggleHabitParams = z.object({
            id: z.string().uuid(),
        })

        const { id } = toggleHabitParams.parse(request.params)

        const today = dayjs().startOf('day').toDate()

        let day = await prisma.day.findUnique({
            where: {
                date: today,
            }
        })

        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: today,
                }
            })
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id,
                }
            }
        })

        if (dayHabit) {
            //remover a marcação de completo
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id,
                }
            })
        } else {
          //Completar o hábito
          await prisma.dayHabit.create({
            data: {
                day_id: day.id,
                habit_id: id,
            }
        })
        }

        
    })

    app.get('/summary', async () => {
        //prisma ORM: RAW SQL => SQLite

        const summary = await prisma.$queryRaw`
            select 
                D.id, 
                D.date,
                (
                    select 
                        cast(count(*) as float)
                    from day_habits DH
                    where DH.day_id = D.id
                )   as completed,
                (
                    select
                        cast(count(*) as float)
                    from habit_week_days HWD
                    join habits H
                        on H.id = HWD.habit_id
                    where
                        HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
                        and H.created_at <= D.date
                ) as amount
                 
            from days D
        ` 

        return summary
    })
}



