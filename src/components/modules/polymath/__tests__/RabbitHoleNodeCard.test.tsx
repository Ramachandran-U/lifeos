import { render, screen, fireEvent } from '@testing-library/react-native';
import { RabbitHoleNodeCard } from '@/components/modules/polymath/RabbitHoleNodeCard';
import { nodeFromGenerated, type RabbitHoleNode } from '@/explore/rabbitHoleTree';
import type { GeneratedNode } from '@/explore/rabbitHole';

const gen: GeneratedNode = {
  title: 'Schooling fish vs flocks',
  body: 'Fish school with a lateral-line sense that flocks do not have — same three rules.',
  goDeeperHint: 'the shared math',
  goSidewaysHint: 'a third medium',
};
const node = (parentId: string | null): RabbitHoleNode =>
  nodeFromGenerated(gen, { id: 'n1', parentId, arrivedVia: parentId ? 'sideways' : null, createdAt: '2026-06-05T10:00:00.000Z' });

describe('RabbitHoleNodeCard', () => {
  it('renders the node title, body and both fork hints', () => {
    render(<RabbitHoleNodeCard node={node('root')} onClimb={() => {}} onMap={() => {}} />);
    expect(screen.getByText('Schooling fish vs flocks')).toBeTruthy();
    expect(screen.getByText('the shared math')).toBeTruthy();
    expect(screen.getByText('a third medium')).toBeTruthy();
  });

  it('fires onClimb from "Climb to parent" on a non-root node', () => {
    const onClimb = jest.fn();
    render(<RabbitHoleNodeCard node={node('root')} onClimb={onClimb} onMap={() => {}} />);
    fireEvent.press(screen.getByText('‹ Climb to parent'));
    expect(onClimb).toHaveBeenCalledTimes(1);
  });
});
