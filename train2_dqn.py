import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
import random

class DQN(nn.Module):
    def __init__(self, input_size=6, output_size=4): 
        super(DQN, self).__init__()
        self.fc1 = nn.Linear(input_size, 128)
        self.fc2 = nn.Linear(128, 128)
        self.fc3 = nn.Linear(128, output_size)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)

class KAreaEnv:
    def __init__(self, csv_path):
        self.grid = pd.read_csv(csv_path, header=None).values
        self.max_y, self.max_x = self.grid.shape
        self.target_pos = None
        self.actions = [(-1, 0), (1, 0), (0, -1), (0, 1)] 
        
    def get_state(self, current, target):
        dy = (target[0] - current[0]) / self.max_y
        dx = (target[1] - current[1]) / self.max_x
        u = 1 if (current[0]-1 >= 0 and self.grid[current[0]-1, current[1]] != 1) else 0
        d = 1 if (current[0]+1 < self.max_y and self.grid[current[0]+1, current[1]] != 1) else 0
        l = 1 if (current[1]-1 >= 0 and self.grid[current[0], current[1]-1] != 1) else 0
        r = 1 if (current[1]+1 < self.max_x and self.grid[current[0], current[1]+1] != 1) else 0
        return [dy, dx, u, d, l, r]

    def step(self, current_pos, action_idx):
        dy, dx = self.actions[action_idx]
        new_y, new_x = current_pos[0] + dy, current_pos[1] + dx
        
        if new_y < 0 or new_y >= self.max_y or new_x < 0 or new_x >= self.max_x:
            return current_pos, -100, True 
            
        next_pos = (new_y, new_x)
        cell_type = self.grid[new_y, new_x]
        
        if self.target_pos is not None and next_pos == self.target_pos:
            return next_pos, 100, True   
            
        if cell_type == 1:
            return current_pos, -100, True 
        elif cell_type == 3:
            return next_pos, -50, False
        else:
            return next_pos, -1, False

def train():
    # 使用絕對路徑讀取剛剛產生的真實比例 CSV
    env = KAreaEnv("/Users/hehouxuan/專題2/maptest_02_server/public/maps/K_Area_Grid_Real.csv")
    model = DQN(input_size=6, output_size=4)
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.MSELoss()
    
    epsilon = 1.0       
    epsilon_min = 0.01
    epsilon_decay = 0.999 
    gamma = 0.95        
    epochs = 15000      
    rewards_history = []
    
    print("🚀 開始訓練 DQN 模型 (75x25 真實比例網格)...")
    for epoch in range(epochs):
        state = (random.randint(0, env.max_y-1), random.randint(0, env.max_x-1))
        while env.grid[state[0], state[1]] == 1:
            state = (random.randint(0, env.max_y-1), random.randint(0, env.max_x-1))
            
        target = (random.randint(0, env.max_y-1), random.randint(0, env.max_x-1))
        while env.grid[target[0], target[1]] == 1:
            target = (random.randint(0, env.max_y-1), random.randint(0, env.max_x-1))
        env.target_pos = target
        
        total_reward = 0
        done = False
        step_count = 0
        
        while not done and step_count < 300: # 網格變大，增加步數上限
            state_vec = env.get_state(state, target)
            state_tensor = torch.FloatTensor(state_vec)
            
            if random.random() < epsilon:
                action = random.randint(0, 3)
            else:
                q_values = model(state_tensor)
                action = torch.argmax(q_values).item()
                
            next_state, reward, done = env.step(state, action)
            next_state_vec = env.get_state(next_state, target)
            next_state_tensor = torch.FloatTensor(next_state_vec)
            
            q_values = model(state_tensor)
            next_q_values = model(next_state_tensor)
            
            target_q = q_values.clone()
            target_q[action] = reward + (gamma * torch.max(next_q_values) if not done else 0)
            
            loss = loss_fn(q_values, target_q.detach())
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            state = next_state
            total_reward += reward
            step_count += 1
            
        epsilon = max(epsilon_min, epsilon * epsilon_decay)
        rewards_history.append(total_reward)
        
        if (epoch + 1) % 1000 == 0:
            avg_reward = np.mean(rewards_history[-100:])
            print(f"回合: {epoch+1}/{epochs} | 平均報酬: {avg_reward:.1f} | Epsilon: {epsilon:.3f}")
            
    torch.save(model.state_dict(), "dqn_model.pth")
    print("✅ 訓練完成，模型已儲存為 dqn_model.pth")

if __name__ == "__main__":
    train()