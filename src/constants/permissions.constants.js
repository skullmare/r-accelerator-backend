const PERMISSIONS_CONFIG = {
    USERS: {
        label: "Пользователи",
        actions: {
            READ: {
                key: 'users.read', label: 'Просмотр списка пользователей'
            },
            UPDATE_ROLE: {
                key: 'users_role.update', label: 'Редактирование роли пользователей'
            },
            UPDATE: {
                key: 'users.update', label: 'Редактирование пользователей'
            }
        }
    },
    ROLES: {
        label: "Роли",
        actions: {
            READ: {
                key: 'roles.read', label: 'Просмотр списка ролей'
            },
            CREATE: {
                key: 'roles.create', label: 'Создание роли'
            },
            UPDATE: {
                key: 'roles.update', label: 'Редактирование роли'
            },
            DELETE: {
                key: 'roles.delete', label: 'Удаление роли'
            }
        }
    },
    STUDY_PROGRAMS: {
        label: "Программы обучения",
        actions: {
            READ: {
                key: 'study_programs.read', label: 'Просмотр списка программ обучения'
            },
            CREATE: {
                key: 'study_programs.create', label: 'Создание программы обучения'
            },
            UPDATE: {
                key: 'study_programs.update', label: 'Редактирование программы обучения'
            },
            DELETE: {
                key: 'study_programs.delete', label: 'Удаление программы обучения'
            }
        }
    },
    STUDY_LESSONS: {
        label: "Уроки",
        actions: {
            READ: {
                key: 'study_lessons.read', label: 'Просмотр списка уроков'
            },
            CREATE: {
                key: 'study_lessons.create', label: 'Создание урока'
            },
            UPDATE: {
                key: 'study_lessons.update', label: 'Редактирование урока'
            },
            DELETE: {
                key: 'study_lessons.delete', label: 'Удаление урока'
            }
        }
    },
    STUDY_AGENTS: {
        label: "Обучающие агенты",
        actions: {
            READ: {
                key: 'study_agents.read', label: 'Просмотр списка обучающих агентов'
            },
            CREATE: {
                key: 'study_agents.create', label: 'Создание обучающего агента'
            },
            UPDATE: {
                key: 'study_agents.update', label: 'Редактирование обучающего агента'
            },
            DELETE: {
                key: 'study_agents.delete', label: 'Удаление обучающего агента'
            }
        }
    }
}

const ALL_PERMISSIONS = Object.values(PERMISSIONS_CONFIG)
    .flatMap(program => Object.values(program.actions).map(action => action.key));

const getPermissionsForUI = () => {
    return Object.keys(PERMISSIONS_CONFIG).map(key => ({
        program: PERMISSIONS_CONFIG[key].label,
        actions: Object.values(PERMISSIONS_CONFIG[key].actions)
    }));
};

export { PERMISSIONS_CONFIG, ALL_PERMISSIONS, getPermissionsForUI };