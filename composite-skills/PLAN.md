# Composite Skills �����ƻ�

> ��ɫ��Skill ������ | �߽磺[AGENTS.md](AGENTS.md)

## ��ǰ�汾��5 ����� Skill���ȶ���

## �����
- [x] `project-handover` �� ��Ա���ӣ�����Ԥ��+����ת�ƣ�
- [x] `project-registry` �� ��Ŀע���ܱ�
- [x] `project-matrix` �� ����Ŀ������ͼ������/��Ա/��̱���
- [x] `project-report` �� �ձ�/�ܱ�/�±��Զ�����
- [x] `meeting-reminder` �� ��ǰ���ѣ���װ cron-scheduler��
- [x] `cron-scheduler` �� ͨ�ö�ʱ������������ PA �ᵽ��ܲ㣩
- [x] `project-init` �� ��Ŀһ������
- [x] `project-close` �� ��Ŀ��ֹ/����
- [x] `create-weekly-report` �� ��Ŀ�ܱ�����
- [x] `organize-meeting` �� ������֯���������� + �ճ� + ���죩
- [x] `meeting-minutes` ��ǿ �� ֧��д����Ŀ�ƻ�����planDocId��
- [x] `create-weekly-report` ��ǿ �� ֧�ּ�Ҫ��������
- [x] `meeting-minutes` �� �����Ҫ��������ȡ���� + ���ࣩ
- [x] `party-vote` �� ����ͶƱ�Ƽ�������ѡ��Ƭ + �����¼��
- [x] `info-gathering` �� ��Ϣ�㼯����

## �ƻ��У������ȼ���

### P4-1: ����������Ϊ party-bot��
- [ ] `party-news-draft` �� �������Ÿ����ɣ��ռ����Ϣ �� LLM ���� �� �����ĵ���
- [ ] `party-plan-draft` �� �������������
- **����**��`doc_create`��`doc_editContent`������ԭ�� Skill��

### P4-2: ��Ŀ������Ϊ project-bot��
- [x] `project-status-report` �� ��Ŀ״̬���棨���ܴ��� + �ճ� + �ĵ� �� ���ɱ��棩
- **����**��`schedule_getListByRange`��`todo_*`��`doc_getContent`

### ������
- [ ] `multi-source-summary` �� ���ĵ�/������Ϣ�ۺϣ������ܱ��� API �����������
- [ ] `meeting-reminder-broadcast` �� ��������Ⱥ��������ϢȺ��������

## ������ϵ
- **����**��framework�����͡�SkillRegistry��Provider �ӿڣ�
- **������**��bot/���� Bot ͨ�� config.json ������� Skill ����
- ������� Skill �� ���±��ļ� �� ֪ͨ��Ӱ�� Bot �� PM

## �����淶
- ÿ����� Skill ���룺Input/Output ���Ͷ��� + ����У�� + ����ع�
- ���� Skill ������ڱ��� pa-bot ��֤���� 1 ����������
- �����֪ͨ bot PM ���� skill �б�

---

## ������

| ���� | ��� | Ӱ�� |
|------|------|------|
| 2026-05-27 | PO/PA/PM/PC �Ľ�ɫ��ϵ��ʽ��� | ���н�ɫ |
| 2026-05-27 | ֪ʶͬ��Э�� + prompts Ŀ¼ | ���н�ɫ |
| 2026-05-28 | project-handover ��Ա���� ��� | project-bot |
| 2026-05-28 | project-registry + project-matrix + project-init����ע��� ��� | project-bot |
| 2026-05-28 | project-report + cron-scheduler��ǿ(EnhancedCronDeps) + project-init���� ��� | project-bot |
| 2026-05-28 | meeting-reminder + meeting-minutes��ǿ + create-weekly-report��ǿ ��� | project-bot |
| 2026-05-28 | cron-scheduler + project-init + project-close ������ɣ��� PA ע�� | project-bot |
| 2026-05-27 | project-status-report ������ɣ��� PA ע�� | project-bot |
| ������ | �� | �� |
