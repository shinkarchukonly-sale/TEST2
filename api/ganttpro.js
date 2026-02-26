export default async function handler(req, res) {
  // CORS headers — обязательно для всех запросов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight запрос от браузера — отвечаем сразу
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GANTTPRO_API_KEY = process.env.GANTTPRO_API_KEY;

  if (!GANTTPRO_API_KEY) {
    return res.status(500).json({ error: 'GANTTPRO_API_KEY не настроен в переменных окружения Vercel' });
  }

  try {
    const { projectName, tasks } = req.body;

    if (!projectName || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Неверные данные запроса: нужны projectName и tasks[]' });
    }

    // 1. Создаём проект
    const projectResponse = await fetch('https://api.ganttpro.com/v1.0/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': GANTTPRO_API_KEY
      },
      body: JSON.stringify({ name: projectName })
    });

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      return res.status(projectResponse.status).json({
        error: 'Ошибка создания проекта в GanttPro',
        details: errorText,
        status: projectResponse.status
      });
    }

    const projectData = await projectResponse.json();
    // Пробуем разные варианты структуры ответа API
    const projectId =
      projectData?.item?.projectId ||
      projectData?.item?.id ||
      projectData?.projectId ||
      projectData?.id;

    if (!projectId) {
      return res.status(500).json({
        error: 'GanttPro не вернул ID проекта',
        data: projectData
      });
    }

    // 2. Создаём задачи
    let tasksCreated = 0;
    const parentMap = {};

    for (const task of tasks) {
      if (!task.name || task.hours === undefined) continue;

      const taskBody = {
        projectId: projectId,
        name: task.name,
        estimation: Math.round((task.hours || 0) * 60) // GanttPro принимает минуты
      };

      // Устанавливаем родительскую задачу если есть
      if (task.parentSection && parentMap[task.parentSection]) {
        taskBody.parent = parentMap[task.parentSection];
      }

      // Секция = группирующая задача
      if (task.isSection) {
        taskBody.type = 'project';
      }

      try {
        const taskResponse = await fetch('https://api.ganttpro.com/v1.0/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': GANTTPRO_API_KEY
          },
          body: JSON.stringify(taskBody)
        });

        if (taskResponse.ok) {
          const taskData = await taskResponse.json();
          tasksCreated++;

          // Запоминаем ID секции чтобы вложить в неё подзадачи
          const taskId =
            taskData?.item?.id ||
            taskData?.id;

          if (task.isSection && task.name && taskId) {
            parentMap[task.name] = taskId;
          }
        }
      } catch (taskError) {
        // Продолжаем создавать остальные задачи даже если одна упала
        console.error('Ошибка создания задачи:', task.name, taskError.message);
      }
    }

    return res.status(200).json({
      success: true,
      projectId: projectId,
      tasksCreated: tasksCreated,
      message: `Проект "${projectName}" создан с ${tasksCreated} задачами`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
