---
title: "Synology VMM에서 Ubuntu 설치가 멈출 때 확인할 설정"
pubDate: 2026-09-10T09:30:45+09:00
description: "Synology Virtual Machine Manager에서 Ubuntu 설치가 멈추거나 진행되지 않을 때 ISO 이미지, VM 리소스, 부팅 미디어, 콘솔과 QEMU Guest Agent까지 순서대로 점검하는 방법을 정리합니다."
category: Synology
tags:
  - Synology
  - Virtual Machine Manager
  - Ubuntu
  - VMM
  - Virtual Machine
  - QEMU
lang: ko
---

Synology NAS의 Virtual Machine Manager(VMM)를 이용하면 별도 물리 서버 없이 Ubuntu Server를 가상 머신으로 운영할 수 있습니다.

하지만 Ubuntu ISO를 연결하고 VM을 시작했는데 설치 화면에서 멈추거나, 설치가 끝난 뒤 다시 설치 화면으로 돌아오는 문제가 생길 수 있습니다.

이럴 때는 **ISO → VM 리소스 → 저장소 → 부팅 미디어 → 콘솔 → 게스트 도구** 순서로 확인하면 원인을 좁히기 쉽습니다.

## 1. Ubuntu ISO 확인

VMM에서 다음 메뉴를 확인합니다.

```text
Virtual Machine Manager
→ Image
→ ISO File
```

Ubuntu 공식 사이트에서 받은 ISO를 사용하는 것이 좋습니다.

```text
ubuntu-xx.xx-live-server-amd64.iso
```

다운로드 또는 NAS 업로드 과정에서 파일이 손상되었는지 확인하려면 SHA256을 비교할 수 있습니다.

macOS:

```bash
shasum -a 256 ubuntu-xx.xx-live-server-amd64.iso
```

Linux:

```bash
sha256sum ubuntu-xx.xx-live-server-amd64.iso
```

## 2. ISO가 VM에 실제로 연결되어 있는지 확인

ISO를 VMM에 등록했다고 자동으로 VM에 연결되는 것은 아닙니다.

```text
Virtual Machine
→ 대상 VM
→ Action
→ Edit
```

설치 ISO가 CD/DVD 장치로 연결되어 있는지 확인합니다.

## 3. CPU와 메모리를 너무 작게 잡지 않는다

문제 진단용으로는 너무 작은 VM 사양을 피하는 것이 좋습니다.

예:

```text
vCPU: 2
RAM : 2~4 GB
Disk: 20 GB 이상
```

이는 절대적인 최소 요구사항이 아니라 설치 중 리소스 부족 가능성을 먼저 배제하기 위한 예시입니다.

NAS에서 다른 VM을 여러 개 실행 중이라면 일부를 종료한 뒤 다시 테스트합니다.

## 4. 가상 디스크와 NAS 저장소 여유 공간 확인

다음 두 가지를 함께 확인합니다.

```text
VM 가상 디스크 크기
NAS Storage Pool / Volume 여유 공간
```

VM에 충분한 디스크를 할당했더라도 실제 NAS 볼륨이 거의 가득 찬 상태라면 안정적인 설치와 운영이 어렵습니다.

## 5. 설치 화면이 멈춘 것인지 콘솔만 멈춘 것인지 구분

VMM에서 VM을 선택하고 `Connect`로 다시 접속합니다.

화면이 정지해 보여도 VM 자체가 반드시 멈춘 것은 아닙니다.

다음을 확인합니다.

- 키보드 입력 반응 여부
- VM CPU 사용량 변화
- 콘솔 재접속 후 화면 변화
- 정상 종료 명령에 반응하는지

브라우저 콘솔 문제라면 다시 연결했을 때 정상 화면이 나타날 수 있습니다.

## 6. 설치가 끝났는데 다시 설치 화면이 나오는 경우

Ubuntu 설치 후 재부팅했는데 다시 설치 메뉴가 나온다면 ISO가 계속 부팅 미디어로 연결되어 있는지 확인합니다.

```text
설치 완료
→ VM 종료
→ Ubuntu ISO 분리
→ VM 시작
→ 가상 디스크에서 부팅
```

설치 자체가 실패한 것이 아닐 수 있습니다.

## 7. 같은 위치에서 반복적으로 멈춘다면

다음 순서로 하나씩 확인합니다.

```text
1. ISO 체크섬 확인
2. ISO 재업로드
3. RAM 증가
4. vCPU 2개 이상으로 테스트
5. 새 가상 디스크 생성
6. NAS 여유 공간 확인
7. 새 VM을 만들어 동일 ISO로 재현 확인
```

여러 설정을 동시에 바꾸면 실제 원인을 찾기 어려우므로 한 번에 하나씩 변경합니다.

## 8. Ubuntu 설치 후 네트워크 확인

IP 주소:

```bash
ip addr
```

라우팅:

```bash
ip route
```

외부 IP 통신:

```bash
ping -c 4 8.8.8.8
```

DNS:

```bash
ping -c 4 ubuntu.com
```

IP 통신은 되지만 도메인만 실패한다면 DNS 설정을 확인합니다.

## 9. apt 패키지 설치는 sudo 사용

일반 사용자로 다음 명령을 실행하면:

```bash
apt install vim
```

다음과 같은 오류가 발생할 수 있습니다.

```text
Could not open lock file /var/lib/dpkg/lock-frontend
Permission denied
Are you root?
```

관리자 권한으로 실행합니다.

```bash
sudo apt update
sudo apt install vim
```

네트워크 도구가 필요하면:

```bash
sudo apt install net-tools
```

다만 최신 Ubuntu에서는 `ifconfig`, `netstat` 대신 `ip`, `ss` 명령도 많이 사용합니다.

```bash
ip addr
ss -lntp
```

## 10. QEMU Guest Agent 설치

Synology 공식 문서는 Ubuntu VM에서 QEMU Guest Agent 설치를 안내합니다.

```bash
sudo apt update
sudo apt install qemu-guest-agent
```

상태 확인:

```bash
systemctl status qemu-guest-agent
```

필요하면 활성화합니다.

```bash
sudo systemctl enable --now qemu-guest-agent
```

설치 후에는 VMM의 종료·재시작 명령 전달과 게스트 정보 확인이 더 원활해질 수 있습니다.

## 11. 설치 후 기본 점검 명령

```bash
cat /etc/os-release
lscpu
free -h
lsblk
df -h
ip addr
ss -lntp
```

## 최종 점검 순서

```text
Ubuntu ISO 확인
↓
VM에 ISO 연결 확인
↓
CPU / RAM / Disk 확인
↓
NAS 저장공간 확인
↓
VMM 콘솔 재접속
↓
새 VM으로 재현 테스트
↓
설치 후 ISO 분리
↓
Ubuntu 네트워크 확인
↓
QEMU Guest Agent 설치
```

## 마무리

Synology VMM에서 Ubuntu 설치가 멈춘 것처럼 보인다면 Ubuntu 자체만 의심하기보다 **설치 이미지, VM 자원, 저장소, 부팅 미디어와 웹 콘솔**을 함께 확인해야 합니다.

설치 후에는 `qemu-guest-agent`까지 구성해 두면 VMM에서 장기적으로 VM을 관리하기 편합니다.

## 참고 자료

- Synology Knowledge Center - Virtual Machine Manager 이미지 관리  
  https://kb.synology.com/ko-kr/DSM/help/Virtualization/image
- Synology Knowledge Center - QEMU Guest Agent 설치  
  https://kb.synology.com/ko-kr/DSM/tutorial/How_to_install_Synology_Guest_Agent_for_VMM_on_your_virtual_machine
- Ubuntu Server  
  https://ubuntu.com/download/server
