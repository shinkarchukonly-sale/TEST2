export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GANTTPRO_API_KEY = process.env.GANTTPRO_API_KEY;
  
  if (!GANTTPRO_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { projectName, tasks } = req.body;

    if (!projectName || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // 1. Create new project
    const projectResponse = await fetch('https://api.ganttpro.com/v1.0/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GANTTPRO_API_KEY
      },
      body: JSON.stringify({ name: projectName })
    });

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      return res.status(projectResponse.status).json({ 
        error: 'Failed to create project', 
        details: errorText 
      });
    }

    const projectData = await projectResponse.json();
    const projectId = projectData.item?.projectId || projectData.projectId;

    if (!projectId) {
      return res.status(500).json({ error: 'No project ID returned', data: projectData });
    }

    // 2. Create tasks with hierarchy
    const createdTasks = [];
    const parentMap = {}; // Map section names to their IDs

    for (const task of tasks) {
      const taskBody = {
        projectId: projectId,
        name: task.name,
        estimation: task.hours * 60 // GanttPro uses minutes
      };

      // If task has a parent section, find its ID
      if (task.parentSection && parentMap[task.parentSection]) {
        taskBody.parent = parentMap[task.parentSection];
      }

      // If this is a section (group), set type to "project" for grouping
      if (task.isSection) {
        taskBody.type = 'project';
      }

      const taskResponse = await fetch('https://api.ganttpro.com/v1.0/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': GANTTPRO_API_KEY
        },
        body: JSON.stringify(taskBody)
      });

      if (taskResponse.ok) {
        const taskData = await taskResponse.json();
        createdTasks.push(taskData.item || taskData);
        
        // Save section ID for child tasks
        if (task.isSection && taskData.item?.id) {
          parentMap[task.name] = taskData.item.id;
        }
      } else {
        console.error('Failed to create task:', task.name, await taskResponse.text());
      }
    }

    return res.status(200).json({
      success: true,
      projectId: projectId,
      tasksCreated: createdTasks.length,
      message: `Project "${projectName}" created with ${createdTasks.length} tasks`
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
