# ��Ŀ Bot �����ƻ�

> Bot PM����ָ�� | ���ߣ����� AI �������� | ƾ�ݣ�����ȡ

## Ŀ��
רҵ��Ŀ�������֣���������Ŀ�������Ŷӳ�Ա��

## ���ĳ��������ȼ�����

### ���� 1����֯��Ŀ���飨P0��
- **����**�������᡹����֯���项����������
- **����**��ȷ�������ʱ����λ��ˡ�ʱ�� �� `organize-meeting`
- **����**���û�˵����������3����֯��Ŀ����᡹��Bot ׷�ʲλ��˺󴴽�����+�ճ�+����
- **���� Skill**��`organize-meeting`�����У�

### ���� 2��׫д��Ŀ�ܱ���P0��
- **����**�����ܱ��������ܽ�չ������Ŀ�㱨��
- **����**���ռ���չ/�ƻ�/���� �� `create-weekly-report` ����
- **���� Skill**��`create-weekly-report`�����У�

### ���� 3�����������Ҫ��P0��
- **����**������Ҫ���������¼��
- **����**���������� �� `meeting-minutes` ��ȡ���� + ���ɽṹ����Ҫ
- **���� Skill**��`meeting-minutes`�����У�

### ���� 4����Ŀ��Ϣ���ܣ�P1��
- **����**������Ŀ��չ�������ܷ�����
- **����**���ռ���Դ���� �� `info-gathering` ���ɱ���
- **���� Skill**��`info-gathering`�����У�

### ���� 5�����������P1��
- **����**�������졹�����񡹡����䡹
- **����**��ȷ������/������/��ֹ���� �� `todo_create`
- **���� Skill**��`todo_create`������ԭ�� Skill��

### ���� 6����Ŀ״̬���棨P2��
- **����**������Ŀ״̬�������ȱ��桹
- **����**�����ܴ���+�ճ�+�ĵ� �� LLM �����ۺϱ���
- **��������� Skill**��`project-status-report`���� composite-skills/PLAN.md��

## ��ǰ����
- [x] �ȴ� `project-status-report` ��� Skill ������ɣ��ļ��Ѵ������� PA ע�ᣩ
- [x] ��д agent.md
- [x] cron-scheduler / project-init / project-close �������
- [x] config.json �����б�+Ȩ������
- [x] ���� config.json skills �б�
- [x] P1: meeting-reminder + meeting-minutes��ǿ + create-weekly-report��ǿ
- [x] P1: agent.md ����ȫ���̣���ͻ���+ȷ�Ϸֲ�+��ǰ����+��Ҫ���ƻ�����
- [x] P2: project-report + cron-scheduler��ǿ + project-init���ɶ�ʱ����
- [x] P3: project-registry + project-matrix ����Ŀ��ͼ
- [x] P4: project-handover ��Ա���ӣ���ͻ���+ȷ�Ϸֲ�+��ǰ����+��Ҫ���ƻ�����
- [ ] ���� pa-bot ��֤ 5 ������
- [ ] ��ȡ��ʽ Bot ƾ�� �� ����

## ����
- composite-skills: `project-status-report`����������
- composite-skills: `organize-meeting`��`create-weekly-report`��`meeting-minutes`��`info-gathering`������ɣ�
- framework: v0.2.0+

## ������
- party-bot �ľ��峡���Ϳ�������
