import * as React from "react";
import styled, { keyframes } from "styled-components";
import Scene from "~/components/Scene";
import useStores from "~/hooks/useStores";

function SelfDestruction() {
  const [count, setCount] = React.useState(10);
  const [exploded, setExploded] = React.useState(false);
  const { auth } = useStores();

  React.useEffect(() => {
    if (count <= 0) {
      setExploded(true);
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  React.useEffect(() => {
    if (!exploded) {
      return;
    }
    const timer = setTimeout(() => {
      void auth.logout({ userInitiated: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [exploded, auth]);

  return (
    <Scene
      icon={<span style={{ fontSize: "20px" }}>💣</span>}
      title="Self-destruction"
    >
      <Container>
        {exploded ? (
          <>
            <Explosion>💥</Explosion>
            <LogoutMsg>Session terminated. Goodbye.</LogoutMsg>
          </>
        ) : (
          <>
            <Label>SELF-DESTRUCTION IN</Label>
            <Clock warning={count <= 3}>{String(count).padStart(2, "0")}</Clock>
            <Seconds>SECONDS</Seconds>
          </>
        )}
      </Container>
    </Scene>
  );
}

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
`;

const explodeAnim = keyframes`
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 16px;
`;

const Label = styled.div`
  font-size: 14px;
  letter-spacing: 4px;
  color: #888;
  font-family: monospace;
`;

const Seconds = styled.div`
  font-size: 14px;
  letter-spacing: 4px;
  color: #888;
  font-family: monospace;
`;

const Clock = styled.div<{ warning: boolean }>`
  font-size: 120px;
  font-family: monospace;
  font-weight: bold;
  color: ${({ warning }) => (warning ? "#e03e3e" : "#2ecc71")};
  animation: ${({ warning }) => (warning ? blink : "none")} 0.6s ease infinite;
  line-height: 1;
  text-shadow: 0 0 30px ${({ warning }) => (warning ? "#e03e3e66" : "#2ecc7166")};
`;

const Explosion = styled.div`
  font-size: 160px;
  animation: ${explodeAnim} 0.5s ease-out forwards;
`;

const LogoutMsg = styled.div`
  font-size: 16px;
  letter-spacing: 3px;
  color: #e03e3e;
  font-family: monospace;
  animation: ${fadeIn} 0.6s ease 0.4s both;
`;

export default SelfDestruction;
