const PERMISSIONS_CONFIG = {
    USERS: {
        label: "Пользователи",
        actions: {
            READ: {
                key: 'users.read', label: 'Просмотр списка пользователей'
            },
            UPDATE_ROLE: {
                key: 'users.update', label: 'Редактирование роли пользователей'
            },
            UPDATE: {
                key: 'users.update', label: 'Редактирование пользователей'
            }
        }
    },
    COURSE_AGENTS: {
        label: "Агенты",
        actions: {
            READ: {
                key: 'agents.read', label: 'Просмотр списка агентов'
            },
            CREATE: {
                key: 'agents.create', label: 'Создание агента'
            },
            UPDATE: {
                key: 'agents.update', label: 'Редактирование агента'
            },
            DELETE: {
                key: 'agents.delete', label: 'Удаление агента'
            }
        }
    },
    OPENAI_ASSISTANTS: {
        label: "Ассистенты",
        actions: {
            READ: {
                key: 'assistants.read', label: 'Просмотр списка ассистентов'
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
    COURSE_GROUPS: {
        label: "Группы курсов",
        actions: {
            READ: {
                key: 'course_groups.read', label: 'Просмотр списка групп курсов'
            },
            CREATE: {
                key: 'course_groups.create', label: 'Создание группы курсов'
            },
            UPDATE: {
                key: 'course_groups.update', label: 'Редактирование группы курсов'
            },
            DELETE: {
                key: 'course_groups.delete', label: 'Удаление группы курсов'
            }
        }
    }
}

const ALL_PERMISSIONS = Object.values(PERMISSIONS_CONFIG)
    .flatMap(group => Object.values(group.actions).map(action => action.key));

const getPermissionsForUI = () => {
    return Object.keys(PERMISSIONS_CONFIG).map(key => ({
        group: PERMISSIONS_CONFIG[key].label,
        actions: Object.values(PERMISSIONS_CONFIG[key].actions)
    }));
};

export { PERMISSIONS_CONFIG, ALL_PERMISSIONS, getPermissionsForUI };