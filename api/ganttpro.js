module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const GANTTPRO_API_KEY = process.env.GANTTPRO_API_KEY;
  if (!GANTTPRO_API_KEY) {
    res.status(500).json({ error: 'GANTTPRO_API_KEY не настроен' });
    return;
  }

  try {
    const { projectName, tasks } = req.body;

    if (!projectName || !tasks || !Array.isArray(tasks)) {
      res.status(400).json({ error: 'Нужны projectName и tasks[]' });
      return;
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

    const projectData = await projectResponse.json();

    // GanttPro возвращает ID в поле data.ganttId
    const projectId =
      (projectData.data && (projectData.data.ganttId || projectData.data.id)) ||
      (projectData.item && (projectData.item.projectId || projectData.item.id)) ||
      projectData.projectId ||
      projectData.id;

    if (!projectId) {
      res.status(500).json({ error: 'GanttPro не вернул ID проекта', data: projectData });
      return;
    }

    // 2. Создаём задачи
    let tasksCreated = 0;
    const parentMap = {};

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.name) continue;

      const taskBody = {
        projectId: projectId,
        name: task.name,
        estimation: Math.round((task.hours || 0) * 60)
      };

      if (task.parentSection && parentMap[task.parentSection]) {
        taskBody.parent = parentMap[task.parentSection];
      }

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
          const taskId =
            (taskData.data && taskData.data.id) ||
            (taskData.item && taskData.item.id) ||
            taskData.id;
          if (task.isSection && task.name && taskId) {
            parentMap[task.name] = taskId;
          }
        }
      } catch (e) {}
    }

    res.status(200).json({
      success: true,
      projectId: projectId,
      tasksCreated: tasksCreated,
      message: 'Проект "' + projectName + '" создан с ' + tasksCreated + ' задачами'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
