// api/ganttpro.js — Vercel Serverless Function
// Принимает задачи из калькулятора и создаёт проект в GanttPro

const GANTTPRO_API_KEY = process.env.GANTTPRO_API_KEY;
const GANTTPRO_BASE = 'https://api.ganttpro.com/v1';

module.exports = async (req, res) => {
    // CORS headers — разрешаем запросы с любого домена
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!GANTTPRO_API_KEY) {
        return res.status(500).json({ error: 'GANTTPRO_API_KEY не задан в переменных окружения Vercel' });
    }

    const { projectName, tasks } = req.body;

    if (!projectName || !tasks || !tasks.length) {
        return res.status(400).json({ error: 'Не переданы projectName или tasks' });
    }

    try {
        // ШАГ 1: Создаём проект
        const createProjectRes = await fetch(`${GANTTPRO_BASE}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': GANTTPRO_API_KEY
            },
            body: JSON.stringify({ name: projectName })
        });

        const projectRaw = await createProjectRes.json();
        console.log('GanttPro create project response:', JSON.stringify(projectRaw));

        // GanttPro возвращает ID в разных полях в зависимости от версии API
        const projectId =
            projectRaw?.data?.ganttId ||
            projectRaw?.data?.id ||
            projectRaw?.item?.projectId ||
            projectRaw?.item?.id ||
            projectRaw?.projectId ||
            projectRaw?.id ||
            projectRaw?.ganttId;

        if (!projectId) {
            return res.status(500).json({
                error: 'GanttPro не вернул ID проекта',
                raw: projectRaw
            });
        }

        console.log('Project created, ID:', projectId);

        // ШАГ 2: Создаём задачи
        // Сначала создаём секции (родительские задачи), потом подзадачи
        const sectionIds = {}; // name → id созданной секции
        let tasksCreated = 0;

        for (const task of tasks) {
            if (task.hours === 0 && !task.isSection) continue; // пропускаем нулевые подзадачи

            try {
                const taskBody = {
                    name: task.name,
                    project_id: projectId,
                    duration: task.isSection ? 0 : Math.max(1, task.hours), // часы → длительность
                };

                // Привязываем к родительской секции
                if (!task.isSection && task.parentSection && sectionIds[task.parentSection]) {
                    taskBody.parent_id = sectionIds[task.parentSection];
                }

                const taskRes = await fetch(`${GANTTPRO_BASE}/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': GANTTPRO_API_KEY
                    },
                    body: JSON.stringify(taskBody)
                });

                const taskData = await taskRes.json();
                console.log(`Task "${task.name}":`, JSON.stringify(taskData).slice(0, 200));

                // Запоминаем ID секции для привязки дочерних задач
                if (task.isSection) {
                    const taskId =
                        taskData?.data?.id ||
                        taskData?.data?.ganttId ||
                        taskData?.item?.id ||
                        taskData?.id;

                    if (taskId) {
                        sectionIds[task.name] = taskId;
                    }
                }

                tasksCreated++;
            } catch (taskErr) {
                console.error(`Error creating task "${task.name}":`, taskErr.message);
                // Продолжаем — не прерываем из-за одной задачи
            }
        }

        return res.status(200).json({
            success: true,
            projectId,
            tasksCreated,
            message: `Проект создан, задач добавлено: ${tasksCreated}`
        });

    } catch (err) {
        console.error('Fatal error:', err);
        return res.status(500).json({
            error: err.message || 'Внутренняя ошибка сервера'
        });
    }
};
