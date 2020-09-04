#!/bin/bash
#script for debugging mongodb problems
#gets a mongodb shell
exec docker run -it --network codetectcalc_dbnet --rm mongo:4 mongo --host db -u root -p 'virusdata'
