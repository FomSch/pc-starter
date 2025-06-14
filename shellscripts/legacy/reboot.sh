#!/bin/bash

gpio -1 mode 8 out
gpio -1 write 8 1
sleep 0.5
gpio -1 write 8 0
gpio -1 mode 8 in