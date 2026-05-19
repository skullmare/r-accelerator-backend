import User from '../../../models/user.model.js';
import CourseGroup from '../../../models/course/group.model.js';

export async function accessibleAgents(req, res) {
    const user = await User.findById(req.user.id, 'courseGroup');
    if (!user.courseGroup) return res.success([], 'Доступные агенты получены', 200);

    const group = await CourseGroup.findOne({ _id: user.courseGroup, active: true }).populate('agents');
    if (!group) return res.success([], 'Доступные агенты получены', 200);

    return res.success(group.agents, 'Доступные агенты получены', 200);
}
