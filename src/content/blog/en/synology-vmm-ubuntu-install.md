---
title: "Troubleshooting Ubuntu Installation Freezes in Synology VMM"
pubDate: 2026-09-10T09:30:45+09:00
description: "A practical checklist for troubleshooting Ubuntu installation stalls in Synology Virtual Machine Manager, including ISO images, VM resources, storage, boot media, console behavior, and QEMU Guest Agent setup."
category: Synology
tags:
  - Synology
  - Virtual Machine Manager
  - Ubuntu
  - VMM
  - Virtual Machine
  - QEMU
lang: en
updatedDate: "2026-10-12"
---

Synology Virtual Machine Manager (VMM) makes it possible to run Ubuntu Server directly on a NAS without a separate physical server.

Sometimes the Ubuntu installer appears to freeze, stops progressing, or returns to the installer after a reboot.

A useful troubleshooting order is:

```text
ISO image
→ VM resources
→ storage
→ boot media
→ console
→ guest integration
```

## 1. Verify the Ubuntu ISO

In VMM, check:

```text
Virtual Machine Manager
→ Image
→ ISO File
```

Use an ISO downloaded from the official Ubuntu site.

Example:

```text
ubuntu-xx.xx-live-server-amd64.iso
```

To verify the download, compare its SHA256 checksum.

macOS:

```bash
shasum -a 256 ubuntu-xx.xx-live-server-amd64.iso
```

Linux:

```bash
sha256sum ubuntu-xx.xx-live-server-amd64.iso
```

## 2. Confirm that the ISO is attached to the VM

Uploading an ISO to VMM does not automatically attach it to a VM.

```text
Virtual Machine
→ select VM
→ Action
→ Edit
```

Make sure the Ubuntu ISO is configured as the virtual CD/DVD installation medium.

## 3. Avoid extremely small VM resources

For troubleshooting, start with enough resources to eliminate obvious resource pressure.

Example:

```text
vCPU: 2
RAM : 2–4 GB
Disk: 20 GB or more
```

These are diagnostic example values, not universal minimum requirements.

If the NAS is already running several VMs, stop unnecessary workloads and test again.

## 4. Check both virtual disk size and NAS free space

Verify:

```text
VM virtual disk size
NAS Storage Pool / Volume free space
```

A VM can have a sufficiently large virtual disk while the underlying NAS volume is almost full.

## 5. Distinguish a frozen guest from a frozen console

Use `Connect` in VMM and reconnect to the console.

Check whether:

- keyboard input works,
- VM CPU activity changes,
- reconnecting changes the screen,
- the VM responds to a normal shutdown request.

A browser-console issue can look like a guest OS freeze.

## 6. Detach the installation ISO after setup

If Ubuntu installation finishes but the VM returns to the installer, the ISO may still be the boot medium.

```text
Installation completes
→ shut down VM
→ detach Ubuntu ISO
→ start VM
→ boot from virtual disk
```

## 7. If it always stops at the same point

Use a controlled sequence:

```text
1. Verify ISO checksum
2. Re-upload ISO
3. Increase RAM
4. Test with at least two vCPUs
5. Create a new virtual disk
6. Check NAS free space
7. Create a clean VM with the same ISO
```

Change one variable at a time so the real cause is easier to identify.

## 8. Verify networking after Ubuntu boots

```bash
ip addr
ip route
ping -c 4 8.8.8.8
ping -c 4 ubuntu.com
```

If IP connectivity works but hostname resolution fails, investigate DNS.

## 9. Use sudo for package installation

Running:

```bash
apt install vim
```

as a normal user may return:

```text
Could not open lock file /var/lib/dpkg/lock-frontend
Permission denied
Are you root?
```

Use:

```bash
sudo apt update
sudo apt install vim
```

If legacy networking tools are needed:

```bash
sudo apt install net-tools
```

Current Ubuntu systems also commonly use:

```bash
ip addr
ss -lntp
```

## 10. Install QEMU Guest Agent

Synology's official documentation recommends QEMU Guest Agent for Ubuntu VMs.

```bash
sudo apt update
sudo apt install qemu-guest-agent
```

Check it:

```bash
systemctl status qemu-guest-agent
```

If necessary:

```bash
sudo systemctl enable --now qemu-guest-agent
```

This can improve integration for VM shutdown/restart operations and guest information detection.

## 11. Useful post-install checks

```bash
cat /etc/os-release
lscpu
free -h
lsblk
df -h
ip addr
ss -lntp
```

## Final troubleshooting order

```text
Verify Ubuntu ISO
↓
Confirm ISO attachment
↓
Check CPU / RAM / disk
↓
Check NAS storage
↓
Reconnect VMM console
↓
Test with a clean VM
↓
Detach ISO after installation
↓
Verify Ubuntu networking
↓
Install QEMU Guest Agent
```

## A post-installation storage issue from an operated VM

The Ubuntu virtual server used for this blog's development projects **once reached 100% usage on its root filesystem during operation**. A `df -h /` check showed a filesystem of approximately 31 GB; after disk expansion work, it was approximately 124 GB.

This is **not presented as the confirmed cause of an Ubuntu installation freeze**. It is a related operational problem that shows why disk capacity needs checking even after an installer appears to finish successfully.

A virtual machine has at least three distinct capacity layers:

| Layer | Where to check | Meaning |
|---|---|---|
| NAS physical storage | DSM Storage Manager | Capacity backing the virtual disks |
| Virtual disk assigned to the VM | VMM VM settings | Block storage presented to the guest |
| Ubuntu partition and filesystem | `lsblk`, `df -h /` | Storage currently usable by Ubuntu |

```bash
lsblk
df -h /
df -i /
```

Increasing a disk in VMM does **not necessarily resize the guest partition and filesystem automatically**. The safe procedure depends on whether the VM uses LVM, its partition layout and filesystem. Review backups and the actual layout before attempting partition changes.

## Separate installer problems from post-install failures

| Observation | First checks | What it suggests |
|---|---|---|
| No ISO boot menu | Attached image, boot order, console | Possibly a VM boot configuration issue |
| Installer progress appears stuck | Resources, storage, console responsiveness | Change one variable at a time |
| ISO installer reappears after reboot | Attached media and boot order | Check boot sequence before reinstalling |
| Ubuntu installed but SSH is unavailable | `ip addr`, `ip route`, `ss -lntp` | Isolate network and SSH service |
| Logging or storage fails after installation | `df -h /`, `df -i /`, `lsblk` | Look for guest filesystem pressure |

After Ubuntu has booted, investigate current-boot errors with:

```bash
journalctl -b -p err --no-pager | tail -n 40
```

This command requires a booted Ubuntu guest; it is **not a direct diagnostic for a frozen installer ISO**. Redact hostname and network data before sharing command output publicly.

## Define what a successful installation means

The installer finishing is only one checkpoint. Boot **from the virtual disk with the ISO detached**, log in, check IP and DNS connectivity, confirm free filesystem space, and validate the services that the VM must run.

Related operating notes: [GitHub Actions self-hosted runners](/en/posts/github-actions-self-hosted/) and [Remote MySQL over SSH](/en/posts/ssh-mysql-tunnel/).

## Conclusion

When Ubuntu appears to freeze in Synology VMM, do not assume Ubuntu itself is the only possible cause.

The ISO image, VM resources, storage, boot media, and browser console all affect the installation process.

After installation, configuring `qemu-guest-agent` also makes the VM easier to manage from Synology VMM.

## References

- Synology Knowledge Center - Virtual Machine Manager images  
  https://kb.synology.com/en-global/DSM/help/Virtualization/image
- Synology Knowledge Center - QEMU Guest Agent  
  https://kb.synology.com/en-global/DSM/tutorial/How_to_install_Synology_Guest_Agent_for_VMM_on_your_virtual_machine
- Ubuntu Server  
  https://ubuntu.com/download/server
